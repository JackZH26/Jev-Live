// ETC player-visible API v3. Local offline matches only; no gameplay/stat overrides.
#include "Development/EtcJevBridge.h"
#include "Development/EtcJevMotor.h"
#include "Development/EtcJevController.h"
#include "AI/EtcBotBrainComponent.h"
#include "AI/EtcSpectatorComponent.h"
#include "Containers/Ticker.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "Engine/LocalPlayer.h"
#include "EngineUtils.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerState.h"
#include "AbilitySystemGlobals.h"
#include "AbilitySystem/LyraAbilitySystemComponent.h"
#include "Character/LyraHealthComponent.h"
#include "Equipment/LyraQuickBarComponent.h"
#include "Inventory/LyraInventoryItemInstance.h"
#include "Kismet/GameplayStatics.h"
#include "NavigationSystem.h"
#include "NavigationPath.h"
#include "Misc/App.h"
#include "Misc/CommandLine.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/PlatformProcess.h"
#include "HAL/FileManager.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "UObject/UnrealType.h"
#include "Rooms/EtcLootChest.h"
#include "Rooms/EtcPortalDoor.h"
#include "Rooms/EtcRoomHazardProvider.h"
#include "Rooms/EtcRoom015TrainHazard.h"
#include "Rooms/EtcRoom016RotorHazard.h"
#include "Rooms/EtcRoom019BoardHazard.h"
#include "Items/EtcConsumables.h"
#include "Items/EtcHeadgear.h"
#include "Weapons/EtcWeaponDrop.h"
#include "Weapons/EtcFlashExposureComponent.h"
#include "UI/EtcMatchFlowSubsystem.h"
#include "UI/EtcRoomPickWidget.h"
#include "UI/EtcMapHudSubsystem.h"
#include "UI/EtcRoomEntrySubsystem.h"
#include "System/EtcMatchClockStub.h"
#include "System/EtcMatchResultSubsystem.h"
#include "System/EtcMapAssemblySubsystem.h"
#include "System/EtcRoomStateSubsystem.h"
#include "System/EtcSpawnProtectionSubsystem.h"
#include "System/EtcPortalTravelSubsystem.h"
#include "Teams/LyraTeamSubsystem.h"

namespace EtcJevBridge {
namespace {
FTSTicker::FDelegateHandle Handle;
FString Directory,Token,Session,MatchId,Mode=TEXT("manual"),LastAction;
TWeakObjectPtr<UEtcBotBrainComponent> SharedBrain;
double Epoch=0,Ack=0,Lease=0,NextState=0,NextSession=0,SessionUntil=0,Frame=0;
int32 Shots=0,PreviousMagazine=-1,PreviousSlot=-1,LastRoom=-1;
FString PreviousWeapon;
TWeakObjectPtr<APawn> OwnedPawn;
TWeakObjectPtr<UWorld> ObservedWorld;
bool SawLiving=false;
float ObservedHealth=-1, SearchYaw=0;
double SearchUntil=0,NextAwareness=0,LastDamageAt=0;
TWeakObjectPtr<UEtcMapHudSubsystem> OwnedMap;
TSharedPtr<FJsonObject> MapSnapshot;
double MapStarted=0,MapVisibleSince=0;
int32 MapRevision=0,MapStartRevision=0;
bool MapFinished=false,MapSucceeded=false,MapWasOpen=false,MapCaptured=false;
bool HasVisibleEnemy=false;
struct FRememberedThreat { FVector Eye; double Until=0; TWeakObjectPtr<APawn> Pawn; };
TArray<FRememberedThreat> RememberedThreats;
struct FAction {
  FString Id,Kind;TWeakObjectPtr<AActor> Target;FVector Goal=FVector::ZeroVector;
  float Distance=0;bool Safe=true;int32 Destination=-1,Rank=0,Slot=-1,Risk=0,ReplacementSlot=-1;
};
TArray<FAction> Offered;FAction Active;
double Now(){const FDateTime T=FDateTime::UtcNow();return double(T.ToUnixTimestamp())*1000.0+T.GetMillisecond();}
TSharedPtr<FJsonObject> Read(const FString& File){
  const int64 Size=IFileManager::Get().FileSize(*File);if(Size<0||Size>32768)return nullptr;
  FString Text;TSharedPtr<FJsonObject> O;
  if(FFileHelper::LoadFileToString(Text,*File))FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text),O);return O;
}
FString Str(const TSharedPtr<FJsonObject>& O,const TCHAR* Key){FString V;if(O)O->TryGetStringField(Key,V);return V;}
double Num(const TSharedPtr<FJsonObject>& O,const TCHAR* Key){double V=-1;if(O)O->TryGetNumberField(Key,V);return V;}
void Vector(const TSharedPtr<FJsonObject>& O,const TCHAR* Key,const FVector& V){
  TArray<TSharedPtr<FJsonValue>> A;for(double N:{V.X,V.Y,V.Z})A.Add(MakeShared<FJsonValueNumber>(N));O->SetArrayField(Key,A);
}
void Release(const FString& Reason=TEXT("invalidated")){
  if(auto* Hud=OwnedMap.Get())Hud->HideGlobalMap();
  OwnedMap.Reset();MapStarted=0;MapFinished=false;
  if(auto* Brain=SharedBrain.Get())Brain->StopExternalControl(Reason);
  Active=FAction();
}
UEtcBotBrainComponent* Executor(APlayerController* PC){
  if(!PC)return nullptr;
  auto* Brain=PC->FindComponentByClass<UEtcBotBrainComponent>();
  if(!Brain){Brain=NewObject<UEtcBotBrainComponent>(PC);Brain->SetComponentTickEnabled(false);Brain->RegisterComponentWithWorld(PC->GetWorld());}
  auto* Aim=PC->FindComponentByClass<UEtcBotAimComponent>();
  if(!Aim){Aim=NewObject<UEtcBotAimComponent>(PC);Aim->SetDifficulty(EEtcBotTier::Pro);Aim->RegisterComponentWithWorld(PC->GetWorld());}
  SharedBrain=Brain;return Brain;
}
bool Protected(UWorld* W,APawn* P){auto* S=W?W->GetSubsystem<UEtcSpawnProtectionSubsystem>():nullptr;return S&&P&&S->IsProtected(P);}
bool Traveling(UWorld* W,APawn* P){auto* S=W?W->GetSubsystem<UEtcPortalTravelSubsystem>():nullptr;return S&&P&&S->IsTraveling(P);}
UWorld* World(){if(GEngine)for(const FWorldContext& C:GEngine->GetWorldContexts())if(C.World()&&C.World()->IsGameWorld()&&C.World()->GetFirstPlayerController())return C.World();return nullptr;}
bool Visible(APawn* P,AActor* A){
  if(!P||!IsValid(A)||A==P||A->IsHidden()||A->IsActorBeingDestroyed())return false;
  FVector Start=P->GetPawnViewLocation();FRotator View=P->GetViewRotation();
  const FVector End=A->GetActorLocation()+FVector(0,0,35);
  auto* PC=Cast<APlayerController>(P->GetController());if(!PC)return false;
  PC->GetPlayerViewPoint(Start,View);FVector2D Pixel;int32 Width=0,Height=0;PC->GetViewportSize(Width,Height);
  if(!PC->ProjectWorldLocationToScreen(End,Pixel,true)||Pixel.X<0||Pixel.Y<0||Pixel.X>=Width||Pixel.Y>=Height)return false;
  if(FVector::DistSquared(Start,End)>FMath::Square(7000.f))return false;
  if(!UEtcFlashExposureComponent::CanSeeTarget(P,A))return false;
  FHitResult Hit;FCollisionQueryParams Q(SCENE_QUERY_STAT(JevSight),true,P);Q.AddIgnoredActor(A);
  return !P->GetWorld()->LineTraceSingleByChannel(Hit,Start,End,ECC_Visibility,Q);
}
bool EnemyVisible(APawn* P,APawn* E){
  if(!Visible(P,E)||Protected(P->GetWorld(),E)||Traveling(P->GetWorld(),E))return false;
  if(auto* Teams=P->GetWorld()->GetSubsystem<ULyraTeamSubsystem>();Teams&&!Teams->CanCauseDamage(P,E,false))return false;
  const auto* H=ULyraHealthComponent::FindHealthComponent(E);if(!H||H->GetHealth()<=0)return false;
  auto* M=P->GetWorld()->GetSubsystem<UEtcMapAssemblySubsystem>();
  return !M||M->GetRoomSlotAtLocation(P->GetActorLocation())==M->GetRoomSlotAtLocation(E->GetActorLocation());
}
int32 Stat(UObject* Item,const TCHAR* Name){
  const auto Tag=FGameplayTag::RequestGameplayTag(FName(Name),false);UFunction* F=Item?Item->FindFunction(TEXT("GetStatTagStackCount")):nullptr;
  if(!F||!Tag.IsValid())return -1;struct FArgs{FGameplayTag Tag;int32 ReturnValue=0;} A{Tag};Item->ProcessEvent(F,&A);return A.ReturnValue;
}
FString WeaponName(UObject* Item){
  const auto* P=Item?CastField<FObjectPropertyBase>(FindFProperty<FProperty>(Item->GetClass(),TEXT("ItemDef"))):nullptr;
  return P?GetNameSafe(P->GetObjectPropertyValue_InContainer(Item)):TEXT("");
}
int32 Rank(const FString& S){return S.Contains(TEXT("SR01"))?5:S.Contains(TEXT("SMG"))||S.Contains(TEXT("SG02"))||S.Contains(TEXT("Revolver"))?2:S.Contains(TEXT("LMG"))||S.Contains(TEXT("MG01"))||S.Contains(TEXT("GL01"))?4:S.Contains(TEXT("AR0"))?3:1;}
struct FLoadout{int32 Magazine=-1,Reserve=-1,Capacity=-1,Slot=-1;FString Weapon;};
FLoadout Loadout(APlayerController* PC){
  FLoadout L;auto* Q=PC?PC->FindComponentByClass<ULyraQuickBarComponent>():nullptr;if(!Q)return L;
  const auto Slots=Q->GetSlots();L.Slot=Q->GetActiveSlotIndex();if(!Slots.IsValidIndex(L.Slot))return L;
  auto* Item=Slots[L.Slot];L.Magazine=Stat(Item,TEXT("Lyra.ShooterGame.Weapon.MagazineAmmo"));L.Reserve=Stat(Item,TEXT("Lyra.ShooterGame.Weapon.SpareAmmo"));L.Capacity=Stat(Item,TEXT("Lyra.ShooterGame.Weapon.MagazineSize"));L.Weapon=WeaponName(Item);return L;
}
int32 UpgradeSlot(APlayerController* PC,const AEtcDroppedWeapon* Gun){
  auto* Q=PC?PC->FindComponentByClass<ULyraQuickBarComponent>():nullptr;if(!Q||!Gun)return -1;
  int32 Worst=-1,Lowest=Gun->GetLootRank();const auto Slots=Q->GetSlots();
  for(int32 I=1;I<Slots.Num();++I){if(!Slots[I])return -1;const int32 R=Rank(WeaponName(Slots[I]));if(R<Lowest){Lowest=R;Worst=I;}}
  return Worst;
}
void Offer(const FString& Id,const FString& Kind,APawn* P,AActor* Target=nullptr,FVector Goal=FVector::ZeroVector,bool Safe=true,int32 Dest=-1,int32 R=0,int32 Slot=-1,int32 Risk=0){
  FAction A;A.Id=Id;A.Kind=Kind;A.Target=Target;A.Goal=Goal;A.Safe=Safe;A.Destination=Dest;A.Rank=R;A.Slot=Slot;
  A.Risk=Risk;A.Distance=P&&!Goal.IsNearlyZero()?FVector::Dist(P->GetActorLocation(),Goal):0;Offered.Add(A);
}
bool Threatened(EEtcRoomDisplayState S){return S==EEtcRoomDisplayState::Warned||S==EEtcRoomDisplayState::Imminent||S==EEtcRoomDisplayState::Collapsed||S==EEtcRoomDisplayState::Upcoming;}
void Observe(UWorld* W,APlayerController* PC,APawn* P,double Time){
  const double Started=FPlatformTime::Seconds();
  if(ObservedWorld.Get()!=W){Release(TEXT("world_changed"));SharedBrain.Reset();ObservedWorld=W;MatchId=FGuid::NewGuid().ToString(EGuidFormats::Digits);SawLiving=false;Shots=0;PreviousMagazine=-1;LastRoom=-1;MapSnapshot.Reset();MapRevision=0;MapWasOpen=false;MapCaptured=false;}
  Offered.Reset();FString Phase=TEXT("loading");float Health=0,MaxHealth=100;
  const bool Offline=W&&W->GetNetMode()==NM_Standalone;
  auto* Result=W?W->GetSubsystem<UEtcMatchResultSubsystem>():nullptr;
  if(W&&W->GetMapName().Contains(TEXT("MainMenu")))Phase=TEXT("menu");
  else if(P){const auto* H=ULyraHealthComponent::FindHealthComponent(P);Health=H?H->GetHealth():0;MaxHealth=H?FMath::Max(1.f,H->GetMaxHealth()):100;Phase=Health>0?TEXT("playing"):TEXT("dead");
    const auto* Flow=W->GetSubsystem<UEtcMatchFlowSubsystem>();if(Flow&&Flow->IsManagingEntry()&&!Flow->HasDroppedIn())Phase=TEXT("loading");}
  if(Phase==TEXT("playing"))SawLiving=true;if(!P&&SawLiving)Phase=TEXT("dead");
  if(Result&&Result->HasMatchEnded())Phase=TEXT("ended");else if(W&&W->IsPaused())Phase=TEXT("paused");
  if(!Offline)Phase=TEXT("unsupported");
  auto* Map=W?W->GetSubsystem<UEtcMapAssemblySubsystem>():nullptr;
  auto* Rooms=W?W->GetSubsystem<UEtcRoomStateSubsystem>():nullptr;
  const int32 Slot=Map&&P?Map->GetRoomSlotAtLocation(P->GetActorLocation()):-1;
  if(Slot!=LastRoom){Release(TEXT("room_changed"));LastRoom=Slot;RememberedThreats.Reset();ObservedHealth=-1;SearchUntil=0;LastDamageAt=0;NextAwareness=Time+1500;}
  if(Health>0&&ObservedHealth>=0&&Health<ObservedHealth-.5f){LastDamageAt=Time;if(Time>SearchUntil){SearchUntil=Time+1200;SearchYaw=(PC?PC->GetControlRotation().Yaw:0)+(FMath::RandBool()?85.f:-85.f);}}
  ObservedHealth=Health;
  RememberedThreats.RemoveAll([Time](const FRememberedThreat& T){return T.Until<Time;});
  TArray<FEtcRoomView> Views;if(Rooms)Rooms->GetRoomViews(Views);TMap<int32,int32> Risks;bool Danger=false;float Evac=-1;
  for(const auto& V:Views){Risks.Add(V.SlotIndex,V.State==EEtcRoomDisplayState::Safe?0:V.State==EEtcRoomDisplayState::Upcoming?1:V.State==EEtcRoomDisplayState::Collapsed?4:2);if(V.SlotIndex==Slot){Evac=V.EvacuationSecondsLeft;Danger=Threatened(V.State)||Evac>0;}}
  const auto L=Loadout(PC);
  auto* Hud=PC&&PC->GetLocalPlayer()?PC->GetLocalPlayer()->GetSubsystem<UEtcMapHudSubsystem>():nullptr;
  const bool MapOpen=Hud&&Hud->IsGlobalMapOpen();
  int32 ZonePhase=0;bool WarningActive=false;float ZoneSeconds=-1;
  const auto* Clock=W?W->GetSubsystem<UEtcMatchClockStub>():nullptr;
  const bool HasCountdown=Clock&&Clock->GetPhaseCountdown(ZonePhase,WarningActive,ZoneSeconds);
  const FString ZoneStage=!HasCountdown?TEXT("complete"):WarningActive?TEXT("collapse"):TEXT("warning");
  if(MapOpen&&!MapWasOpen){MapVisibleSince=Time;MapCaptured=false;}
  MapWasOpen=MapOpen;
  // Read only the public overlay's projection, after it has actually been open
  // for rendering. Closing M freezes this knowledge until the next map review.
  if(MapOpen&&!MapCaptured&&Time-MapVisibleSince>=200&&Rooms&&Rooms->IsMapReady()){
    MapSnapshot=MakeShared<FJsonObject>();MapSnapshot->SetNumberField(TEXT("revision"),++MapRevision);MapSnapshot->SetNumberField(TEXT("observedAt"),Time);
    MapSnapshot->SetNumberField(TEXT("phase"),ZonePhase);MapSnapshot->SetStringField(TEXT("stage"),ZoneStage);
    TArray<TSharedPtr<FJsonValue>> MapRooms,Edges;
    for(const auto& V:Views){auto R=MakeShared<FJsonObject>();R->SetNumberField(TEXT("id"),V.SlotIndex);R->SetNumberField(TEXT("number"),V.DisplayRoomNumber);R->SetNumberField(TEXT("x"),V.GridOrigin.X);R->SetNumberField(TEXT("y"),V.GridOrigin.Y);R->SetNumberField(TEXT("w"),V.GridSize.X);R->SetNumberField(TEXT("h"),V.GridSize.Y);R->SetNumberField(TEXT("risk"),Risks.FindRef(V.SlotIndex));R->SetBoolField(TEXT("visited"),V.bVisited);MapRooms.Add(MakeShared<FJsonValueObject>(R));}
    for(const auto& E:Rooms->GetPlan().Edges){TArray<TSharedPtr<FJsonValue>> Pair;Pair.Add(MakeShared<FJsonValueNumber>(E.SlotA));Pair.Add(MakeShared<FJsonValueNumber>(E.SlotB));Edges.Add(MakeShared<FJsonValueArray>(Pair));}
    MapSnapshot->SetArrayField(TEXT("rooms"),MapRooms);MapSnapshot->SetArrayField(TEXT("edges"),Edges);MapCaptured=true;
  }
  if(L.Weapon==PreviousWeapon&&L.Slot==PreviousSlot&&PreviousMagazine>=0&&L.Magazine>=0&&L.Magazine<PreviousMagazine)Shots+=PreviousMagazine-L.Magazine;
  PreviousMagazine=L.Magazine;PreviousWeapon=L.Weapon;PreviousSlot=L.Slot;
  auto* Items=PC?PC->FindComponentByClass<UEtcConsumableComponent>():nullptr;
  bool GauzeActive=false;if(auto* ASC=UAbilitySystemGlobals::GetAbilitySystemComponentFromActor(P)){FGameplayEffectQuery Query;Query.EffectDefinition=UEtcGE_GauzeHeal::StaticClass();GauzeActive=!ASC->GetActiveEffects(Query).IsEmpty();}
  TArray<TSharedPtr<FJsonValue>> Enemies;
  Offer(TEXT("wait"),TEXT("wait"),P);
  TSharedPtr<FJsonObject> PickState;
  auto* EntryFlow=W?W->GetSubsystem<UEtcMatchFlowSubsystem>():nullptr;
  auto* Pick=EntryFlow?EntryFlow->GetRoomPickForPlayer():nullptr;
  if(Offline&&Phase==TEXT("loading")&&Pick&&Pick->GetSecondsLeftForPlayer()>0){
    PickState=MakeShared<FJsonObject>();PickState->SetNumberField(TEXT("locked"),Pick->GetLockedSlotForPaint());PickState->SetNumberField(TEXT("secondsLeft"),Pick->GetSecondsLeftForPlayer());
    TArray<TSharedPtr<FJsonValue>> PublicRooms;const auto& Plan=Pick->GetPlanForPaint();
    for(const auto& Room:Plan.Rooms){int32 Exits=0,Loot=0;for(const auto& E:Plan.Edges)if(E.SlotA==Room.SlotIndex||E.SlotB==Room.SlotIndex)++Exits;
      for(const auto& C:Pick->GetChestMarksForPaint())if(C.SlotIndex==Room.SlotIndex&&!C.bDeathCache)Loot+=1+static_cast<int32>(C.Tier);
      auto R=MakeShared<FJsonObject>();R->SetNumberField(TEXT("id"),Room.SlotIndex);R->SetNumberField(TEXT("exits"),Exits);R->SetNumberField(TEXT("loot"),Loot);R->SetBoolField(TEXT("hotspot"),Pick->IsHotspotForPaint(Room.SlotIndex));PublicRooms.Add(MakeShared<FJsonValueObject>(R));
      Offer(FString::Printf(TEXT("pick_room_%d"),Room.SlotIndex),TEXT("pick_room"),P,nullptr,FVector::ZeroVector,true,Room.SlotIndex);
    }PickState->SetArrayField(TEXT("rooms"),PublicRooms);
  }
  if(Offline&&(Phase==TEXT("menu")||Phase==TEXT("ended")||Phase==TEXT("dead")))Offer(TEXT("new_match"),TEXT("new_match"),P);
  if(Phase==TEXT("playing")&&!Traveling(W,P)){
    Offer(TEXT("scan"),TEXT("scan"),P);
    if(Hud&&Rooms&&Rooms->IsMapReady())Offer(TEXT("inspect_map"),TEXT("inspect_map"),P);
    if(L.Magazine>=0&&L.Reserve>0&&(L.Capacity<=0||L.Magazine<L.Capacity))Offer(TEXT("reload"),TEXT("reload"),P);
    // Let an owned, already active recovery effect finish instead of wasting
    // another item. Critical health may still justify an instant recovery.
    if(Items&&!Items->IsCasting()&&Health<MaxHealth&&(!GauzeActive||Health<MaxHealth*.4f))for(int32 I=0;I<3;++I)if(Items->GetCount(static_cast<EEtcConsumableType>(I))>0&&!(I==0&&GauzeActive)){
      const float Missing=MaxHealth-Health;const int32 Utility=I==1?(Missing>=45?6:1):I==2?(Missing<=25?5:3):(Missing>25?4:2);
      Offer(FString::Printf(TEXT("heal_%d"),I),TEXT("heal"),P,nullptr,FVector::ZeroVector,true,-1,Utility,I);
    }
    if(auto* Q=PC->FindComponentByClass<ULyraQuickBarComponent>()){
      const auto Slots=Q->GetSlots();for(int32 I=0;I<Slots.Num();++I){if(I==L.Slot||!Slots[I])continue;
        const int32 Mag=Stat(Slots[I],TEXT("Lyra.ShooterGame.Weapon.MagazineAmmo")),R=Rank(WeaponName(Slots[I]));
        if(Mag>0&&(L.Magazine<=0||R>Rank(L.Weapon)))Offer(FString::Printf(TEXT("equip_%d"),I),TEXT("equip"),P,nullptr,FVector::ZeroVector,true,-1,R,I);}
    }
    TArray<APawn*> Seen;
    for(TActorIterator<APawn> It(W);It&&Seen.Num()<31;++It)if(!MapOpen&&EnemyVisible(P,*It)){
      Seen.Add(*It);auto E=MakeShared<FJsonObject>();E->SetStringField(TEXT("id"),It->GetName());Vector(E,TEXT("position"),It->GetActorLocation());Vector(E,TEXT("velocity"),It->GetVelocity());E->SetNumberField(TEXT("distance"),FVector::Dist(P->GetActorLocation(),It->GetActorLocation()));Enemies.Add(MakeShared<FJsonValueObject>(E));
      Offer(TEXT("engage_")+It->GetName(),TEXT("engage"),P,*It,It->GetActorLocation());
      RememberedThreats.RemoveAll([&It](const FRememberedThreat& T){return T.Pawn.Get()==*It;});
      RememberedThreats.Add({It->GetPawnViewLocation(),Time+5000,*It});
    }
    HasVisibleEnemy=!Seen.IsEmpty();if(HasVisibleEnemy)SearchUntil=0;
    if(Map&&Slot>=0){
      for(auto* D:Map->GetDoorsForRoom(Slot))if(D&&D->LinkedPortal&&!D->bCollapsed&&!D->LinkedPortal->bCollapsed){
        const int32 Dest=D->LinkedPortal->OwnerRoomSlot;
        // A yellow map warning is a risk, not a physically closed door. A dead
        // end must still be able to evacuate through an endangered neighbour.
        const int32 Risk=Risks.FindRef(Dest);
        Offer(TEXT("portal_")+D->GetName(),TEXT("portal"),P,D,D->GetActorLocation()+D->GetActorForwardVector()*190.f,Risk<4,Dest,0,-1,Risk);
      }
      int32 I=0;for(const auto& C:Map->GetCoverPointsForRoom(Slot)){
        if(++I>16||RememberedThreats.IsEmpty())break;const FVector G=C.Transform.GetLocation();
        // Last-seen snapshots only: never update an offscreen opponent's position.
        bool Covered=true;for(const auto& T:RememberedThreats){FHitResult Hit;FCollisionQueryParams Q(SCENE_QUERY_STAT(JevCover),false,P);if(T.Pawn.IsValid())Q.AddIgnoredActor(T.Pawn.Get());
          if(!W->LineTraceSingleByChannel(Hit,T.Eye,G+FVector(0,0,65),ECC_Visibility,Q)){Covered=false;break;}}
        if(Covered)Offer(FString::Printf(TEXT("cover_%d"),I),TEXT("cover"),P,nullptr,G);
      }
      for(const auto& Weak:Map->GetChestsForRoom(Slot)){auto* C=Cast<AEtcLootChest>(Weak.Get());if(C&&!C->IsOpened()&&(C->ShouldShowOnMap()||Visible(P,C))&&Offered.Num()<90)Offer(TEXT("loot_")+C->GetName(),TEXT("loot"),P,C,C->GetActorLocation());}
      for(TActorIterator<AEtcDroppedWeapon> It(W);It&&Offered.Num()<100;++It)if(Map->GetRoomSlotAtLocation(It->GetActorLocation())==Slot&&Visible(P,*It)){
        const int32 Replacement=UpgradeSlot(PC,*It);if(It->CanBePickedUpBy(P)||Replacement>=1){Offer(TEXT("pickup_")+It->GetName(),TEXT("pickup"),P,*It,It->GetActorLocation(),true,-1,It->GetLootRank());Offered.Last().ReplacementSlot=Replacement;}
      }
      for(TActorIterator<AEtcItemPickup> It(W);It&&Offered.Num()<110;++It)if(Map->GetRoomSlotAtLocation(It->GetActorLocation())==Slot&&Visible(P,*It)&&It->CanGiveAnyTo(PC))Offer(TEXT("pickup_")+It->GetName(),TEXT("pickup"),P,*It,It->GetActorLocation());
      const auto* Headgear=P->FindComponentByClass<UEtcHeadgearComponent>();
      if(!Headgear||!Headgear->HasHeadgear())for(TActorIterator<AEtcHeadgearPickup> It(W);It&&Offered.Num()<120;++It)if(It->GetItem().IsValid()&&Map->GetRoomSlotAtLocation(It->GetActorLocation())==Slot&&Visible(P,*It))Offer(TEXT("pickup_")+It->GetName(),TEXT("pickup"),P,*It,It->GetActorLocation(),true,-1,2);
    }
  }
  auto O=MakeShared<FJsonObject>();O->SetNumberField(TEXT("version"),3);O->SetStringField(TEXT("appId"),TEXT("5272970"));O->SetStringField(TEXT("session"),Session);O->SetStringField(TEXT("matchId"),MatchId);
  if(PickState)O->SetObjectField(TEXT("roomPick"),PickState);
  auto Zone=MakeShared<FJsonObject>();Zone->SetNumberField(TEXT("phase"),ZonePhase);Zone->SetStringField(TEXT("stage"),ZoneStage);Zone->SetNumberField(TEXT("secondsLeft"),HasCountdown?FMath::Max(0.f,ZoneSeconds):-1.f);O->SetObjectField(TEXT("zone"),Zone);
  if(MapSnapshot){MapSnapshot->SetBoolField(TEXT("open"),MapOpen);O->SetObjectField(TEXT("mapView"),MapSnapshot);}
  else if(MapOpen){auto M=MakeShared<FJsonObject>();M->SetBoolField(TEXT("open"),true);M->SetNumberField(TEXT("revision"),0);M->SetNumberField(TEXT("observedAt"),0);M->SetNumberField(TEXT("phase"),ZonePhase);M->SetStringField(TEXT("stage"),ZoneStage);M->SetArrayField(TEXT("rooms"),{});M->SetArrayField(TEXT("edges"),{});O->SetObjectField(TEXT("mapView"),M);}
  O->SetNumberField(TEXT("timestamp"),Time);O->SetNumberField(TEXT("frame"),++Frame);O->SetNumberField(TEXT("processId"),FPlatformProcess::GetCurrentProcessId());O->SetStringField(TEXT("phase"),Phase);O->SetStringField(TEXT("mode"),Mode);O->SetNumberField(TEXT("epoch"),Epoch);O->SetNumberField(TEXT("ack"),Ack);O->SetBoolField(TEXT("foreground"),FApp::HasFocus());O->SetStringField(TEXT("map"),W?W->GetMapName():TEXT("none"));
  auto S=MakeShared<FJsonObject>();Vector(S,TEXT("position"),P?P->GetActorLocation():FVector::ZeroVector);S->SetNumberField(TEXT("health"),FMath::Max(0.f,Health));S->SetNumberField(TEXT("maxHealth"),MaxHealth);S->SetNumberField(TEXT("magazine"),L.Magazine);S->SetNumberField(TEXT("reserve"),L.Reserve);S->SetStringField(TEXT("weapon"),L.Weapon);S->SetBoolField(TEXT("protected"),Protected(W,P));S->SetBoolField(TEXT("traveling"),Traveling(W,P));S->SetBoolField(TEXT("healing"),Items&&Items->IsCasting());S->SetNumberField(TEXT("room"),Slot);S->SetBoolField(TEXT("danger"),Danger);S->SetNumberField(TEXT("evacuationSeconds"),Evac);S->SetNumberField(TEXT("kills"),PC?UEtcMatchResultSubsystem::GetEliminationCount(PC->PlayerState):0);O->SetObjectField(TEXT("self"),S);O->SetArrayField(TEXT("enemies"),Enemies);
  if(const auto* Character=Cast<ACharacter>(P))S->SetBoolField(TEXT("grounded"),Character->GetCharacterMovement()->IsMovingOnGround());
  if(L.Capacity>0)S->SetNumberField(TEXT("magazineCapacity"),L.Capacity);
  bool Reloading=false;if(auto* ASC=UAbilitySystemGlobals::GetAbilitySystemComponentFromActor(P))for(const auto& Spec:ASC->GetActivatableAbilities())if(Spec.IsActive()&&Spec.Ability&&Spec.Ability->GetName().Contains(TEXT("Reload"))&&!Spec.Ability->GetName().Contains(TEXT("AutoReload"))){Reloading=true;break;}
  S->SetBoolField(TEXT("reloading"),Reloading);
  S->SetBoolField(TEXT("gauzeActive"),GauzeActive);
  if(Items){TArray<TSharedPtr<FJsonValue>> Counts;for(int32 I=0;I<3;++I)Counts.Add(MakeShared<FJsonValueNumber>(Items->GetCount(static_cast<EEtcConsumableType>(I))));S->SetArrayField(TEXT("consumables"),Counts);}
  if(const auto* Spectator=PC?PC->FindComponentByClass<UEtcSpectatorComponent>():nullptr)S->SetNumberField(TEXT("damageDealt"),Spectator->GetDamageDealt());
  // This is the current room's normal arrival-title identity. Never disclose
  // archetypes of unvisited slots from the generated map's internal catalog.
  const auto* Entry=PC&&PC->GetLocalPlayer()?PC->GetLocalPlayer()->GetSubsystem<UEtcRoomEntrySubsystem>():nullptr;
  if(Phase==TEXT("playing")&&Entry&&Entry->GetCurrentSlot()==Slot&&Entry->GetCurrentRoomId()>0&&Entry->GetCurrentRoomId()<99)S->SetNumberField(TEXT("roomType"),Entry->GetCurrentRoomId());
  TArray<TSharedPtr<FJsonValue>> Actions;for(const auto& A:Offered){auto J=MakeShared<FJsonObject>();J->SetStringField(TEXT("id"),A.Id);J->SetStringField(TEXT("kind"),A.Kind);J->SetNumberField(TEXT("distance"),A.Distance);J->SetBoolField(TEXT("safe"),A.Safe);J->SetNumberField(TEXT("destination"),A.Destination);J->SetNumberField(TEXT("rank"),A.Rank);J->SetNumberField(TEXT("destinationRisk"),A.Risk);if(A.ReplacementSlot>=1)J->SetNumberField(TEXT("replacementSlot"),A.ReplacementSlot);if(A.Target.IsValid())J->SetStringField(TEXT("target"),A.Target->GetName());Actions.Add(MakeShared<FJsonValueObject>(J));}O->SetArrayField(TEXT("actions"),Actions);
  const int32 Placement=Result?Result->GetLocalPlacement():-1;
  if(Result&&Placement>0&&(Phase==TEXT("dead")||Phase==TEXT("ended"))){auto R=MakeShared<FJsonObject>();R->SetNumberField(TEXT("placement"),Placement);R->SetBoolField(TEXT("won"),Result->HasMatchEnded()&&PC&&Result->GetWinnerPlayerState()==PC->PlayerState);O->SetObjectField(TEXT("result"),R);}else O->SetField(TEXT("result"),MakeShared<FJsonValueNull>());
  auto D=MakeShared<FJsonObject>();D->SetNumberField(TEXT("heldInputs"),SharedBrain.IsValid()?SharedBrain->GetExternalHeldInputs():0);D->SetNumberField(TEXT("shots"),Shots);D->SetBoolField(TEXT("stuck"),SharedBrain.IsValid()&&SharedBrain->GetExternalStatus()==TEXT("blocked"));D->SetNumberField(TEXT("observationMs"),(FPlatformTime::Seconds()-Started)*1000);D->SetStringField(TEXT("lastAction"),LastAction);if(PC){auto V=MakeShared<FJsonObject>();V->SetNumberField(TEXT("yaw"),PC->GetControlRotation().Yaw);V->SetNumberField(TEXT("pitch"),PC->GetControlRotation().Pitch);const auto* Aim=EtcJevController::Aim(PC);V->SetNumberField(TEXT("speed"),Aim?Aim->GetPlayerViewSpeed():0);V->SetStringField(TEXT("owner"),Aim?FString::FromInt(Aim->GetPlayerViewPriority()):TEXT("manual"));D->SetObjectField(TEXT("view"),V);}O->SetObjectField(TEXT("diagnostics"),D);
  auto X=MakeShared<FJsonObject>();X->SetStringField(TEXT("kind"),TEXT("shared-bot-v1"));
  if(P){auto Motion=MakeShared<FJsonObject>();const auto* Character=Cast<ACharacter>(P);const auto* Aim=EtcJevController::Aim(PC);Motion->SetBoolField(TEXT("crouched"),Character&&Character->bIsCrouched);Motion->SetBoolField(TEXT("adsHeld"),Aim&&Aim->GetHeldInputCount()>0);Motion->SetNumberField(TEXT("speed"),P->GetVelocity().Size2D());D->SetObjectField(TEXT("motion"),Motion);}
  auto* Brain=SharedBrain.Get();
  X->SetStringField(TEXT("objective"),Brain?Brain->GetExternalObjective():TEXT(""));
  X->SetStringField(TEXT("status"),Brain?Brain->GetExternalStatus():TEXT("released"));
  X->SetStringField(TEXT("reason"),Brain?Brain->GetExternalReason():TEXT("not_started"));
  if(Brain&&Brain->GetExternalObjective()==TEXT("inspect_map")&&Brain->GetExternalStatus()==TEXT("running")&&MapFinished){X->SetStringField(TEXT("status"),MapSucceeded?TEXT("succeeded"):TEXT("blocked"));X->SetStringField(TEXT("reason"),MapSucceeded?TEXT("map_reviewed"):TEXT("map_unavailable"));}
  X->SetNumberField(TEXT("failures"),Brain?Brain->GetExternalFailures():0);
  X->SetNumberField(TEXT("pathStatus"),static_cast<int32>(EtcJevController::Status(PC)));
  O->SetObjectField(TEXT("executor"),X);
  FString Text;FJsonSerializer::Serialize(O,TJsonWriterFactory<>::Create(&Text));const FString File=Directory/TEXT("state.json"),Temp=File+TEXT(".tmp");if(FFileHelper::SaveStringToFile(Text,*Temp,FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM))IFileManager::Get().Move(*File,*Temp,true,true,false,true);
}
void Receive(APawn* P,double Time){
  auto C=Read(Directory/TEXT("command.json"));if(!C||Num(C,TEXT("version"))!=3||Str(C,TEXT("token"))!=Token||Str(C,TEXT("session"))!=Session)return;
  const FString Requested=Str(C,TEXT("mode"));if(Requested!=TEXT("manual")&&Requested!=TEXT("auto"))return;
  if(Requested==TEXT("auto")&&Str(C,TEXT("matchId"))!=MatchId)return;
  const double Id=Num(C,TEXT("id")),E=Num(C,TEXT("epoch")),Expires=Num(C,TEXT("expiresAt"));
  if(!EtcJevMotor::AcceptCommand(Id,Ack,E,Epoch,Expires,Time,Num(C,TEXT("frame")),Frame,Requested==TEXT("manual")))return;
  if(Requested==TEXT("auto")&&Mode==TEXT("manual")&&E<=Epoch)return;
  if(E>Epoch||Requested!=Mode)Release(Requested==TEXT("manual")?TEXT("manual_takeover"):TEXT("control_epoch_changed"));Epoch=E;Ack=Id;Mode=Requested;Lease=Expires;
  if(Mode==TEXT("manual")){Release(TEXT("manual_takeover"));return;}
  const FString IdAction=Str(C,TEXT("action"));const FAction* A=Offered.FindByPredicate([&](const FAction& V){return V.Id==IdAction&&V.Safe;});
  if(!A){Release(TEXT("action_unavailable"));return;}
  Active=*A;
  OwnedPawn=P;LastAction=Active.Id;
}
void Execute(UWorld* W,APlayerController* PC,APawn* P,float Dt,double Time){
  if(Mode!=TEXT("auto"))return;
  if(Time>Lease||Time>SessionUntil||!W||!PC||W->GetNetMode()!=NM_Standalone||!FApp::HasFocus()){
    const FString Reason=Time>SessionUntil?TEXT("session_expired"):Time>Lease?TEXT("lease_expired"):!FApp::HasFocus()?TEXT("focus_lost"):TEXT("unsupported_world");
    Release(Reason);Mode=TEXT("manual");return;
  }
  if(Active.Kind==TEXT("new_match")){Release(TEXT("new_match"));UGameplayStatics::OpenLevel(W,TEXT("/EtcCore/Maps/L_ETC_Match"),true,FString::Printf(TEXT("Experience=B_ETC_Experience_Room?MapGenSeed=%d?NumBots=19"),FMath::Rand()));return;}
  if(auto* Flow=W->GetSubsystem<UEtcMatchFlowSubsystem>();Flow&&Flow->IsManagingEntry()&&!Flow->HasDroppedIn()){
    if(Active.Kind==TEXT("pick_room"))if(auto* Pick=Flow->GetRoomPickForPlayer();Pick&&Pick->GetSecondsLeftForPlayer()>0&&Pick->GetLockedSlotForPaint()!=Active.Destination)Pick->PickRoom(Active.Destination);
    return;
  }
  const auto* Health=ULyraHealthComponent::FindHealthComponent(P);
  if(W->IsPaused()||!P||!Health||Health->GetHealth()<=0||OwnedPawn.Get()!=P||Traveling(W,P)){
    Release(Traveling(W,P)?TEXT("portal_travel"):W->IsPaused()?TEXT("paused"):TEXT("pawn_unavailable"));return;
  }
  if(Active.Id.IsEmpty())return;
  if(Active.Kind==TEXT("engage")&&(!EnemyVisible(P,Cast<APawn>(Active.Target.Get()))||Protected(W,P))){Release(TEXT("target_not_visible"));return;}
  auto* Brain=Executor(PC);if(!Brain)return;
  if(Active.Kind==TEXT("inspect_map")){
    if(!Brain->SetExternalObjective(Active.Id,TEXT("wait"),nullptr,FVector::ZeroVector,Lease))return;
    if(MapFinished)return;
    auto* Hud=PC->GetLocalPlayer()?PC->GetLocalPlayer()->GetSubsystem<UEtcMapHudSubsystem>():nullptr;
    if(!Hud){MapSucceeded=false;MapFinished=true;return;}
    if(MapStarted<=0){MapSucceeded=false;MapStarted=Time;MapStartRevision=MapRevision;if(!Hud->IsGlobalMapOpen()){MapCaptured=false;Hud->HandleMapKeyPressed();if(Hud->IsGlobalMapOpen())OwnedMap=Hud;}}
    if(Time-MapStarted>=1800){if(auto* Owned=OwnedMap.Get())Owned->HideGlobalMap();OwnedMap.Reset();MapFinished=true;MapSucceeded=MapCaptured&&MapRevision>MapStartRevision;}
    return;
  }
  if(auto* Hud=OwnedMap.Get())Hud->HideGlobalMap();OwnedMap.Reset();MapStarted=0;MapFinished=false;
  if(!Brain->SetExternalObjective(Active.Id,Active.Kind,Active.Target.Get(),Active.Goal,Lease))return;
  // Upgrade only after reaching the visible gun, with no current/remembered
  // threat. Activate the normal G-drop ability once; overlap performs pickup.
  if(Active.Kind==TEXT("pickup")&&!HasVisibleEnemy&&RememberedThreats.IsEmpty())if(auto* Gun=Cast<AEtcDroppedWeapon>(Active.Target.Get());Gun&&Visible(P,Gun)&&FVector::DistSquared(P->GetActorLocation(),Gun->GetActorLocation())<FMath::Square(180.f)){
    const int32 Replacement=UpgradeSlot(PC,Gun);
    if(Replacement>=1){auto* Q=PC->FindComponentByClass<ULyraQuickBarComponent>();auto* ASC=Cast<ULyraAbilitySystemComponent>(UAbilitySystemGlobals::GetAbilitySystemComponentFromActor(P));
      if(Q&&ASC)if(auto* F=Q->FindFunction(TEXT("SetActiveSlotIndex"))){struct FArgs{int32 NewIndex;} A{Replacement};Q->ProcessEvent(F,&A);ASC->TryActivateAbilityByClass(UEtcGameplayAbility_DropWeapon::StaticClass());}
    }
  }
  // Healing and quickbar selection call the same public player actions; the brain owns all movement and weapon inputs.
  if(Active.Kind==TEXT("heal")){if(auto* I=PC->FindComponentByClass<UEtcConsumableComponent>();I&&!I->IsCasting())I->TryUse(static_cast<EEtcConsumableType>(Active.Slot));}
  if(Active.Kind==TEXT("equip")){if(auto* Q=PC->FindComponentByClass<ULyraQuickBarComponent>();Q&&Q->GetActiveSlotIndex()!=Active.Slot)if(auto* F=Q->FindFunction(TEXT("SetActiveSlotIndex"))){struct FArgs{int32 NewIndex;} A{Active.Slot};Q->ProcessEvent(F,&A);}}
}
bool Tick(float Dt){
  const double Time=Now();
  if(Time>=NextSession){NextSession=Time+500;auto C=Read(Directory/TEXT("session.json"));
    if(C&&Num(C,TEXT("version"))==3&&Num(C,TEXT("processId"))==FPlatformProcess::GetCurrentProcessId()&&Num(C,TEXT("expiresAt"))>Time&&Num(C,TEXT("expiresAt"))<Time+5000&&Str(C,TEXT("token")).Len()==64){
      if(Session!=Str(C,TEXT("session"))){Release();Session=Str(C,TEXT("session"));Token=Str(C,TEXT("token"));Epoch=0;Ack=0;Frame=0;Mode=TEXT("manual");}SessionUntil=Num(C,TEXT("expiresAt"));
    }
  }
  if(Session.IsEmpty()||Time>SessionUntil){Release(TEXT("session_expired"));Mode=TEXT("manual");return true;}
  UWorld* W=World();auto* PC=W?W->GetFirstPlayerController():nullptr;APawn* P=PC?PC->GetPawn():nullptr;
  if(OwnedPawn.Get()!=P){Release(TEXT("pawn_changed"));OwnedPawn=P;}
  if(Time>=NextState){Observe(W,PC,P,Time);NextState=Time+50;Receive(P,Now());}
  Execute(W,PC,P,FMath::Clamp(Dt,0.f,0.05f),Now());return true;
}
}
bool IsEnemyVisible(const APawn* Pawn,const APawn* Enemy){return Pawn&&Enemy&&EnemyVisible(const_cast<APawn*>(Pawn),const_cast<APawn*>(Enemy));}
bool HasControlLease(const APawn* Pawn){
  const double Time=Now();const auto* Brain=SharedBrain.Get();
  return Pawn&&OwnedPawn.Get()==Pawn&&Pawn->GetNetMode()==NM_Standalone&&FApp::HasFocus()
    &&Mode==TEXT("auto")&&Time<=Lease&&Time<=SessionUntil&&Brain
    &&Brain->IsComponentTickEnabled()&&Brain->GetExternalStatus()==TEXT("running");
}
void UpdateAwarenessLook(APawn* Pawn,float DeltaTime){
  if(!HasControlLease(Pawn)||Active.Kind==TEXT("engage")||Active.Kind==TEXT("inspect_map"))return;
  auto* PC=Cast<APlayerController>(Pawn->GetController());if(!PC)return;
  const double Time=Now();
  // Keep checking the last actually seen bearing while moving to shelter.
  // This requests a look only; firing still requires a fresh visible target.
  if((Active.Kind==TEXT("cover")||Time-LastDamageAt<5000)&&!RememberedThreats.IsEmpty()){
    const auto* Recent=&RememberedThreats[0];for(const auto& T:RememberedThreats)if(T.Until>Recent->Until)Recent=&T;
    if(Recent->Until>=Time){FVector Eye;FRotator Camera;PC->GetPlayerViewPoint(Eye,Camera);const FRotator Goal=PC->GetControlRotation()+((Recent->Eye-Eye).Rotation()-Camera).GetNormalized();if(auto* Aim=EtcJevController::Aim(PC))Aim->RequestPlayerLook(Goal,40);return;}
  }
  if(HasVisibleEnemy)return;
  if(Time>SearchUntil&&Time>=NextAwareness){SearchUntil=Time+FMath::FRandRange(650.f,1100.f);NextAwareness=Time+FMath::FRandRange(2800.f,5500.f);const float Arc=Pawn->GetVelocity().Size2D()>100?28.f:75.f;SearchYaw=PC->GetControlRotation().Yaw+FMath::FRandRange(-Arc,Arc);}
  if(Time>SearchUntil)return;
  // Damage supplies no omniscient bearing. Use short, smooth looks instead of
  // a scheduled 360-degree spin; aiming and traversal have higher priority.
  if(auto* Aim=EtcJevController::Aim(PC))Aim->RequestPlayerLook(FRotator(PC->GetControlRotation().Pitch,SearchYaw,0),20);
}
void Install(){
  if(IsRunningCommandlet()||IsRunningDedicatedServer()||Handle.IsValid())return;
#if WITH_EDITOR
  if(GIsEditor)return;
#endif
  if(!FParse::Value(FCommandLine::Get(),TEXT("JevBridgeDir="),Directory))Directory=FString(FPlatformProcess::UserSettingsDir())/TEXT("JevLive/etc-bridge");
  Directory=FPaths::ConvertRelativePathToFull(Directory);
  Handle=FTSTicker::GetCoreTicker().AddTicker(FTickerDelegate::CreateStatic(&Tick));
}
void Uninstall(){Release();if(Handle.IsValid())FTSTicker::GetCoreTicker().RemoveTicker(Handle);Handle.Reset();}
}
