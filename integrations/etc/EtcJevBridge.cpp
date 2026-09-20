// ETC player-visible API v3. Local offline matches only; no gameplay/stat overrides.
#include "Development/EtcJevBridge.h"
#include "Development/EtcJevMotor.h"
#include "Containers/Ticker.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/Character.h"
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
double Epoch=0,Ack=0,Lease=0,NextState=0,NextSession=0,SessionUntil=0,Frame=0;
double NextPath=0,NextFire=0,FireRelease=0,NextReload=0,FirstSeen=0,ProgressAt=0;
int32 Shots=0,PreviousMagazine=-1,PreviousSlot=-1,LastRoom=-1;
FString PreviousWeapon;
TWeakObjectPtr<APawn> OwnedPawn;
TWeakObjectPtr<UWorld> ObservedWorld;
TWeakObjectPtr<AActor> AimTarget;
FVector ProgressLocation=FVector::ZeroVector,PathGoal=FVector::ZeroVector;
TArray<FVector> PathPoints;
int32 PathIndex=1;
bool SawLiving=false,Stuck=false,AutoCrouched=false;
TSet<FName> Held;
struct FAction {
  FString Id,Kind;TWeakObjectPtr<AActor> Target;FVector Goal=FVector::ZeroVector;
  float Distance=0;bool Safe=true;int32 Destination=-1,Rank=0,Slot=-1;
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
ULyraAbilitySystemComponent* ASC(APawn* P){return P?Cast<ULyraAbilitySystemComponent>(UAbilitySystemGlobals::GetAbilitySystemComponentFromActor(P)):nullptr;}
void Input(APawn* P,FName Name,bool Press){
  const auto Tag=FGameplayTag::RequestGameplayTag(Name,false);auto* A=ASC(P);if(!A||!Tag.IsValid())return;
  if(Press&&!Held.Contains(Name)){A->AbilityInputTagPressed(Tag);Held.Add(Name);}
  if(!Press&&Held.Contains(Name)){A->AbilityInputTagReleased(Tag);Held.Remove(Name);}
}
void ReleaseInputs(){
  const bool AutoJump=Held.Contains(FName(TEXT("InputTag.Jump")));
  if(auto* A=ASC(OwnedPawn.Get()))for(const FName& Name:Held)A->AbilityInputTagReleased(FGameplayTag::RequestGameplayTag(Name,false));
  Held.Empty();if(auto* C=Cast<ACharacter>(OwnedPawn.Get())){if(AutoJump)C->StopJumping();if(AutoCrouched)C->UnCrouch();}AutoCrouched=false;
}
void Crouch(ACharacter* C,bool Wanted){if(!C)return;if(Wanted&&!AutoCrouched){C->Crouch();AutoCrouched=true;}else if(!Wanted&&AutoCrouched){C->UnCrouch();AutoCrouched=false;}}
void Release(){ReleaseInputs();Active=FAction();AimTarget.Reset();FirstSeen=0;PathPoints.Reset();NextPath=0;Stuck=false;}
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
int32 Rank(const FString& S){return S.Contains(TEXT("SR01"))?5:S.Contains(TEXT("MG01"))?4:S.Contains(TEXT("AR0"))?3:S.Contains(TEXT("SMG"))||S.Contains(TEXT("SG0"))?2:1;}
struct FLoadout{int32 Magazine=-1,Reserve=-1,Slot=-1;FString Weapon;};
FLoadout Loadout(APlayerController* PC){
  FLoadout L;auto* Q=PC?PC->FindComponentByClass<ULyraQuickBarComponent>():nullptr;if(!Q)return L;
  const auto Slots=Q->GetSlots();L.Slot=Q->GetActiveSlotIndex();if(!Slots.IsValidIndex(L.Slot))return L;
  auto* Item=Slots[L.Slot];L.Magazine=Stat(Item,TEXT("Lyra.ShooterGame.Weapon.MagazineAmmo"));L.Reserve=Stat(Item,TEXT("Lyra.ShooterGame.Weapon.SpareAmmo"));L.Weapon=WeaponName(Item);return L;
}
void Offer(const FString& Id,const FString& Kind,APawn* P,AActor* Target=nullptr,FVector Goal=FVector::ZeroVector,bool Safe=true,int32 Dest=-1,int32 R=0,int32 Slot=-1){
  FAction A;A.Id=Id;A.Kind=Kind;A.Target=Target;A.Goal=Goal;A.Safe=Safe;A.Destination=Dest;A.Rank=R;A.Slot=Slot;
  A.Distance=P&&!Goal.IsNearlyZero()?FVector::Dist(P->GetActorLocation(),Goal):0;Offered.Add(A);
}
bool Threatened(EEtcRoomDisplayState S){return S==EEtcRoomDisplayState::Warned||S==EEtcRoomDisplayState::Imminent||S==EEtcRoomDisplayState::Collapsed||S==EEtcRoomDisplayState::Upcoming;}
void Observe(UWorld* W,APlayerController* PC,APawn* P,double Time){
  const double Started=FPlatformTime::Seconds();
  if(ObservedWorld.Get()!=W){Release();ObservedWorld=W;MatchId=FGuid::NewGuid().ToString(EGuidFormats::Digits);SawLiving=false;Shots=0;PreviousMagazine=-1;LastRoom=-1;}
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
  if(Slot!=LastRoom){Release();LastRoom=Slot;}
  TArray<FEtcRoomView> Views;if(Rooms)Rooms->GetRoomViews(Views);TSet<int32> Unsafe;bool Danger=false;float Evac=-1;
  for(const auto& V:Views){if(Threatened(V.State))Unsafe.Add(V.SlotIndex);if(V.SlotIndex==Slot){Evac=V.EvacuationSecondsLeft;Danger=Threatened(V.State)||Evac>0;}}
  const auto L=Loadout(PC);
  if(L.Weapon==PreviousWeapon&&L.Slot==PreviousSlot&&PreviousMagazine>=0&&L.Magazine>=0&&L.Magazine<PreviousMagazine)Shots+=PreviousMagazine-L.Magazine;
  if(L.Weapon!=PreviousWeapon||L.Slot!=PreviousSlot)ReleaseInputs();
  PreviousMagazine=L.Magazine;PreviousWeapon=L.Weapon;PreviousSlot=L.Slot;
  auto* Items=PC?PC->FindComponentByClass<UEtcConsumableComponent>():nullptr;
  TArray<TSharedPtr<FJsonValue>> Enemies;
  Offer(TEXT("wait"),TEXT("wait"),P);
  if(Offline&&(Phase==TEXT("menu")||Phase==TEXT("ended")||Phase==TEXT("dead")))Offer(TEXT("new_match"),TEXT("new_match"),P);
  if(Phase==TEXT("playing")&&!Traveling(W,P)){
    Offer(TEXT("scan"),TEXT("scan"),P);
    if(L.Magazine>=0&&L.Reserve>0)Offer(TEXT("reload"),TEXT("reload"),P);
    if(Items&&!Items->IsCasting()&&Health<MaxHealth)for(int32 I=0;I<3;++I)if(Items->GetCount(static_cast<EEtcConsumableType>(I))>0)Offer(FString::Printf(TEXT("heal_%d"),I),TEXT("heal"),P,nullptr,FVector::ZeroVector,true,-1,0,I);
    if(auto* Q=PC->FindComponentByClass<ULyraQuickBarComponent>()){
      const auto Slots=Q->GetSlots();for(int32 I=0;I<Slots.Num();++I){if(I==L.Slot||!Slots[I])continue;
        const int32 Mag=Stat(Slots[I],TEXT("Lyra.ShooterGame.Weapon.MagazineAmmo")),R=Rank(WeaponName(Slots[I]));
        if(Mag>0&&(L.Magazine<=0||R>Rank(L.Weapon)))Offer(FString::Printf(TEXT("equip_%d"),I),TEXT("equip"),P,nullptr,FVector::ZeroVector,true,-1,R,I);}
    }
    TArray<APawn*> Seen;
    for(TActorIterator<APawn> It(W);It&&Seen.Num()<31;++It)if(EnemyVisible(P,*It)){
      Seen.Add(*It);auto E=MakeShared<FJsonObject>();E->SetStringField(TEXT("id"),It->GetName());Vector(E,TEXT("position"),It->GetActorLocation());Vector(E,TEXT("velocity"),It->GetVelocity());E->SetNumberField(TEXT("distance"),FVector::Dist(P->GetActorLocation(),It->GetActorLocation()));Enemies.Add(MakeShared<FJsonValueObject>(E));
      Offer(TEXT("engage_")+It->GetName(),TEXT("engage"),P,*It,It->GetActorLocation());
    }
    if(Map&&Slot>=0){
      for(auto* D:Map->GetDoorsForRoom(Slot))if(D&&D->LinkedPortal&&!D->bCollapsed&&!D->LinkedPortal->bCollapsed){
        const int32 Dest=D->LinkedPortal->OwnerRoomSlot;
        Offer(TEXT("portal_")+D->GetName(),TEXT("portal"),P,D,D->GetActorLocation()+D->GetActorForwardVector()*190.f,!Unsafe.Contains(Dest),Dest);
      }
      int32 I=0;for(const auto& C:Map->GetCoverPointsForRoom(Slot)){
        if(++I>16||Seen.IsEmpty())break;const FVector G=C.Transform.GetLocation();
        bool Covered=true;for(auto* E:Seen){FHitResult Hit;FCollisionQueryParams Q(SCENE_QUERY_STAT(JevCover),false,P);Q.AddIgnoredActor(E);
          if(!W->LineTraceSingleByChannel(Hit,E->GetPawnViewLocation(),G+FVector(0,0,65),ECC_Visibility,Q)){Covered=false;break;}}
        if(Covered)Offer(FString::Printf(TEXT("cover_%d"),I),TEXT("cover"),P,nullptr,G);
      }
      for(const auto& Weak:Map->GetChestsForRoom(Slot)){auto* C=Cast<AEtcLootChest>(Weak.Get());if(C&&!C->IsOpened()&&(C->ShouldShowOnMap()||Visible(P,C))&&Offered.Num()<90)Offer(TEXT("loot_")+C->GetName(),TEXT("loot"),P,C,C->GetActorLocation());}
      for(TActorIterator<AEtcDroppedWeapon> It(W);It&&Offered.Num()<100;++It)if(Map->GetRoomSlotAtLocation(It->GetActorLocation())==Slot&&Visible(P,*It)&&It->CanBePickedUpBy(P))Offer(TEXT("pickup_")+It->GetName(),TEXT("pickup"),P,*It,It->GetActorLocation(),true,-1,It->GetLootRank());
      for(TActorIterator<AEtcItemPickup> It(W);It&&Offered.Num()<110;++It)if(Map->GetRoomSlotAtLocation(It->GetActorLocation())==Slot&&Visible(P,*It)&&It->CanGiveAnyTo(PC))Offer(TEXT("pickup_")+It->GetName(),TEXT("pickup"),P,*It,It->GetActorLocation());
      const auto* Headgear=P->FindComponentByClass<UEtcHeadgearComponent>();
      if(!Headgear||!Headgear->HasHeadgear())for(TActorIterator<AEtcHeadgearPickup> It(W);It&&Offered.Num()<120;++It)if(It->GetItem().IsValid()&&Map->GetRoomSlotAtLocation(It->GetActorLocation())==Slot&&Visible(P,*It))Offer(TEXT("pickup_")+It->GetName(),TEXT("pickup"),P,*It,It->GetActorLocation(),true,-1,2);
    }
  }
  auto O=MakeShared<FJsonObject>();O->SetNumberField(TEXT("version"),3);O->SetStringField(TEXT("appId"),TEXT("5272970"));O->SetStringField(TEXT("session"),Session);O->SetStringField(TEXT("matchId"),MatchId);
  O->SetNumberField(TEXT("timestamp"),Time);O->SetNumberField(TEXT("frame"),++Frame);O->SetNumberField(TEXT("processId"),FPlatformProcess::GetCurrentProcessId());O->SetStringField(TEXT("phase"),Phase);O->SetStringField(TEXT("mode"),Mode);O->SetNumberField(TEXT("epoch"),Epoch);O->SetNumberField(TEXT("ack"),Ack);O->SetBoolField(TEXT("foreground"),FApp::HasFocus());O->SetStringField(TEXT("map"),W?W->GetMapName():TEXT("none"));
  auto S=MakeShared<FJsonObject>();Vector(S,TEXT("position"),P?P->GetActorLocation():FVector::ZeroVector);S->SetNumberField(TEXT("health"),FMath::Max(0.f,Health));S->SetNumberField(TEXT("maxHealth"),MaxHealth);S->SetNumberField(TEXT("magazine"),L.Magazine);S->SetNumberField(TEXT("reserve"),L.Reserve);S->SetStringField(TEXT("weapon"),L.Weapon);S->SetBoolField(TEXT("protected"),Protected(W,P));S->SetBoolField(TEXT("traveling"),Traveling(W,P));S->SetBoolField(TEXT("healing"),Items&&Items->IsCasting());S->SetNumberField(TEXT("room"),Slot);S->SetBoolField(TEXT("danger"),Danger);S->SetNumberField(TEXT("evacuationSeconds"),Evac);S->SetNumberField(TEXT("kills"),PC?UEtcMatchResultSubsystem::GetEliminationCount(PC->PlayerState):0);O->SetObjectField(TEXT("self"),S);O->SetArrayField(TEXT("enemies"),Enemies);
  TArray<TSharedPtr<FJsonValue>> Actions;for(const auto& A:Offered){auto J=MakeShared<FJsonObject>();J->SetStringField(TEXT("id"),A.Id);J->SetStringField(TEXT("kind"),A.Kind);J->SetNumberField(TEXT("distance"),A.Distance);J->SetBoolField(TEXT("safe"),A.Safe);J->SetNumberField(TEXT("destination"),A.Destination);J->SetNumberField(TEXT("rank"),A.Rank);if(A.Target.IsValid())J->SetStringField(TEXT("target"),A.Target->GetName());Actions.Add(MakeShared<FJsonValueObject>(J));}O->SetArrayField(TEXT("actions"),Actions);
  const int32 Placement=Result?Result->GetLocalPlacement():-1;
  if(Result&&Placement>0&&(Phase==TEXT("dead")||Phase==TEXT("ended"))){auto R=MakeShared<FJsonObject>();R->SetNumberField(TEXT("placement"),Placement);R->SetBoolField(TEXT("won"),Result->HasMatchEnded()&&PC&&Result->GetWinnerPlayerState()==PC->PlayerState);O->SetObjectField(TEXT("result"),R);}else O->SetField(TEXT("result"),MakeShared<FJsonValueNull>());
  auto D=MakeShared<FJsonObject>();D->SetNumberField(TEXT("heldInputs"),Held.Num());D->SetNumberField(TEXT("shots"),Shots);D->SetBoolField(TEXT("stuck"),Stuck);D->SetNumberField(TEXT("observationMs"),(FPlatformTime::Seconds()-Started)*1000);D->SetStringField(TEXT("lastAction"),LastAction);O->SetObjectField(TEXT("diagnostics"),D);
  FString Text;FJsonSerializer::Serialize(O,TJsonWriterFactory<>::Create(&Text));const FString File=Directory/TEXT("state.json"),Temp=File+TEXT(".tmp");if(FFileHelper::SaveStringToFile(Text,*Temp,FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM))IFileManager::Get().Move(*File,*Temp,true,true,false,true);
}
void Receive(APawn* P,double Time){
  auto C=Read(Directory/TEXT("command.json"));if(!C||Num(C,TEXT("version"))!=3||Str(C,TEXT("token"))!=Token||Str(C,TEXT("session"))!=Session)return;
  const FString Requested=Str(C,TEXT("mode"));if(Requested!=TEXT("manual")&&Requested!=TEXT("auto"))return;
  if(Requested==TEXT("auto")&&Str(C,TEXT("matchId"))!=MatchId)return;
  const double Id=Num(C,TEXT("id")),E=Num(C,TEXT("epoch")),Expires=Num(C,TEXT("expiresAt"));
  if(!EtcJevMotor::AcceptCommand(Id,Ack,E,Epoch,Expires,Time,Num(C,TEXT("frame")),Frame,Requested==TEXT("manual")))return;
  if(Requested==TEXT("auto")&&Mode==TEXT("manual")&&E<=Epoch)return;
  if(E>Epoch||Requested!=Mode)Release();Epoch=E;Ack=Id;Mode=Requested;Lease=Expires;
  if(Mode==TEXT("manual")){Release();return;}
  const FString IdAction=Str(C,TEXT("action"));const FAction* A=Offered.FindByPredicate([&](const FAction& V){return V.Id==IdAction&&V.Safe;});
  if(!A){Release();return;}
  if(A->Id!=Active.Id){Release();Active=*A;ProgressAt=Time;ProgressLocation=P?P->GetActorLocation():FVector::ZeroVector;}
  else Active=*A;
  OwnedPawn=P;LastAction=Active.Id;
}
bool Hazard(UWorld* W,ACharacter* C,const FVector& Goal,EtcRoomHazard::FBotDirective& D){
  if(!C)return false;
  if(auto* H=W->GetSubsystem<UEtcRoomHazardSubsystem>();H&&H->QueryBotDirective(C,Goal,D))return true;
  EtcRoom019Board::FBotDirective Board;
  if(AEtcRoom019BoardHazard::QueryBotDirective(W,C,Goal,Board)){
    D.AdjustedGoal=Board.AdjustedGoal;D.bOverrideGoal=Board.bOverrideGoal;D.bHoldPosition=Board.bHoldPosition;D.bWatchdogExempt=Board.bWatchdogExempt;return true;
  }
  EtcRoom016Rotor::FBotDirective Rotor;
  if(AEtcRoom016RotorHazard::QueryBotDirective(W,C,Goal,Rotor)){
    D.AdjustedGoal=Rotor.AdjustedGoal;D.bOverrideGoal=Rotor.bOverrideGoal;D.bWatchdogExempt=Rotor.bWatchdogExempt;
    D.bRequestCrouch=Rotor.Action==EtcRoom016Rotor::EBotAction::DodgeHigh;
    D.bRequestJump=Rotor.Action==EtcRoom016Rotor::EBotAction::DodgeLow;return true;
  }
  bool Wait=false;FVector Adjusted;
  if(AEtcRoom015TrainHazard::AdjustBotNavigationGoal(W,C->GetActorLocation(),Goal,Adjusted,Wait)){
    D.AdjustedGoal=Adjusted;D.bOverrideGoal=true;D.bHoldPosition=Wait;D.bWatchdogExempt=Wait;return true;
  }
  return false;
}
void Move(UWorld* W,APawn* P,FVector Goal,float Dt,double Time){
  auto* C=Cast<ACharacter>(P);bool Direct=false,Hold=false;FVector G=Goal;
  if(C){EtcRoomHazard::FBotDirective D;if(Hazard(W,C,Goal,D)){
    if(D.bOverrideGoal)G=D.AdjustedGoal;Hold=D.bHoldPosition;Direct=D.bUseDirectMovement;
    Input(P,TEXT("InputTag.Ability.Sprint"),D.bRequestSprint&&!Hold);Input(P,TEXT("InputTag.Jump"),D.bRequestTraversal||D.bRequestJump);
    Crouch(C,D.bRequestCrouch);if(D.bWatchdogExempt)ProgressAt=Time;
  }else{Input(P,TEXT("InputTag.Ability.Sprint"),false);Input(P,TEXT("InputTag.Jump"),false);Crouch(C,false);}}
  if(Hold)return;
  if(!Direct){
    if(Time>=NextPath||FVector::DistSquared(G,PathGoal)>FMath::Square(100.f)){
      NextPath=Time+200;PathGoal=G;PathPoints.Reset();PathIndex=1;
      if(auto* Path=UNavigationSystemV1::FindPathToLocationSynchronously(W,P->GetActorLocation(),G,P);Path&&Path->IsValid()&&!Path->IsPartial())PathPoints=Path->PathPoints;
    }
    if(PathPoints.Num()<2){Stuck=Time-ProgressAt>1800;return;}
    while(PathIndex<PathPoints.Num()-1&&FVector::Dist2D(P->GetActorLocation(),PathPoints[PathIndex])<65)++PathIndex;
    G=PathPoints[PathIndex];
  }
  const FVector Direction=(G-P->GetActorLocation()).GetSafeNormal2D();P->AddMovementInput(Direction,1.f);
  if(auto* PC=Cast<APlayerController>(P->GetController()))PC->SetControlRotation(EtcJevMotor::AimStep(PC->GetControlRotation(),Direction.Rotation(),Dt));
  if(FVector::DistSquared(P->GetActorLocation(),ProgressLocation)>FMath::Square(70.f)){ProgressAt=Time;ProgressLocation=P->GetActorLocation();Stuck=false;}
  else Stuck=Time-ProgressAt>1800;
}
void Execute(UWorld* W,APlayerController* PC,APawn* P,float Dt,double Time){
  if(Mode!=TEXT("auto"))return;
  if(Time>Lease||Time>SessionUntil||!W||!PC||W->GetNetMode()!=NM_Standalone||!FApp::HasFocus()){Release();Mode=TEXT("manual");return;}
  if(Active.Kind==TEXT("new_match")){Release();UGameplayStatics::OpenLevel(W,TEXT("/EtcCore/Maps/L_ETC_Match"),true,FString::Printf(TEXT("Experience=B_ETC_Experience_Room?MapGenSeed=%d?NumBots=19"),FMath::Rand()));return;}
  const auto* Health=ULyraHealthComponent::FindHealthComponent(P);
  if(W->IsPaused()||!P||!Health||Health->GetHealth()<=0||OwnedPawn.Get()!=P||Traveling(W,P)){Release();return;}
  const bool Moving=Active.Kind==TEXT("portal")||Active.Kind==TEXT("loot")||Active.Kind==TEXT("pickup")||Active.Kind==TEXT("cover");
  if(!Moving){EtcRoomHazard::FBotDirective D;
    if(Hazard(W,Cast<ACharacter>(P),P->GetActorLocation(),D)&&(D.bOverrideGoal||D.bHoldPosition||D.bRequestCrouch||D.bRequestJump||D.bRequestTraversal)){
      Input(P,TEXT("InputTag.Weapon.Fire"),false);Input(P,TEXT("InputTag.Weapon.FireAuto"),false);
      Move(W,P,P->GetActorLocation(),Dt,Time);return;
    }
    Input(P,TEXT("InputTag.Ability.Sprint"),false);Input(P,TEXT("InputTag.Jump"),false);Crouch(Cast<ACharacter>(P),false);
  }
  if(Active.Kind==TEXT("scan")){auto R=PC->GetControlRotation();R.Yaw+=70.f*Dt;PC->SetControlRotation(R);}
  const FLoadout L=Loadout(PC);
  if(Time>=FireRelease)Input(P,TEXT("InputTag.Weapon.Fire"),false);
  if(Active.Kind==TEXT("reload")){
    if(Time>=NextReload&&L.Reserve>0){Input(P,TEXT("InputTag.Weapon.Reload"),true);NextReload=Time+1200;}else Input(P,TEXT("InputTag.Weapon.Reload"),false);
  }
  if(Active.Kind==TEXT("heal")){if(auto* I=PC->FindComponentByClass<UEtcConsumableComponent>();I&&!I->IsCasting())I->TryUse(static_cast<EEtcConsumableType>(Active.Slot));}
  if(Active.Kind==TEXT("equip")){if(auto* Q=PC->FindComponentByClass<ULyraQuickBarComponent>())if(auto* F=Q->FindFunction(TEXT("SetActiveSlotIndex"))){struct FArgs{int32 NewIndex;} A{Active.Slot};Q->ProcessEvent(F,&A);}Release();}
  if(Active.Kind==TEXT("engage")){
    auto* E=Cast<APawn>(Active.Target.Get());if(!EnemyVisible(P,E)){Release();return;}
    if(AimTarget.Get()!=E){AimTarget=E;FirstSeen=Time;}
    FVector Camera;FRotator CameraRotation;PC->GetPlayerViewPoint(Camera,CameraRotation);
    const FVector Point=E->GetActorLocation()+FVector(0,0,35),Delta=Point-Camera;
    const float MotionTime=float(FMath::Fmod(Time,100000.0));
    // Lyra player weapons use CameraTowardsFocus; aim from the actual camera, not the pawn eye.
    FRotator Desired=PC->GetControlRotation()+(Delta.Rotation()-CameraRotation).GetNormalized();Desired.Yaw+=0.25f*FMath::Sin(MotionTime*0.003f);Desired.Pitch+=0.12f*FMath::Cos(MotionTime*0.004f);
    const FRotator R=EtcJevMotor::AimStep(PC->GetControlRotation(),Desired,Dt);PC->SetControlRotation(R);
    const float Error=FMath::RadiansToDegrees(FMath::Acos(FMath::Clamp(FVector::DotProduct(CameraRotation.Vector(),Delta.GetSafeNormal()),-1.f,1.f)));
    const bool Fire=EtcJevMotor::CanFire(Time,FirstSeen,Error,true,Protected(W,P),L.Magazine);
    Input(P,TEXT("InputTag.Weapon.FireAuto"),Fire);
    if(Fire&&Time>=NextFire){Input(P,TEXT("InputTag.Weapon.Fire"),true);FireRelease=Time+60;NextFire=Time+180;}
    const float Side=FMath::Sin(MotionTime*0.0015f)>0?1.f:-1.f;
    const FVector Right=FRotationMatrix(FRotator(0,R.Yaw,0)).GetUnitAxis(EAxis::Y)*Side;
    const FVector Goal=P->GetActorLocation()+Right*120.f;FNavLocation Projected;
    auto* Nav=FNavigationSystem::GetCurrent<UNavigationSystemV1>(W);auto* Hazards=W->GetSubsystem<UEtcRoomHazardSubsystem>();
    float Cost=0;const bool Blocked=Hazards&&Hazards->QueryTraversalPath(P->GetActorLocation(),Goal,Cost)&&Cost>=FLT_MAX;
    if(!Blocked&&Nav&&Nav->ProjectPointToNavigation(Goal,Projected,FVector(35,35,100))&&FVector::Dist2D(Goal,Projected.Location)<40)P->AddMovementInput(Right,0.65f);
  }
  if(Active.Kind==TEXT("portal")||Active.Kind==TEXT("loot")||Active.Kind==TEXT("pickup")||Active.Kind==TEXT("cover")){
    if(Active.Kind!=TEXT("cover")&&!Active.Target.IsValid()){Release();return;}
    const float Distance=FVector::Dist2D(P->GetActorLocation(),Active.Goal);
    if(auto* H=Cast<AEtcHeadgearPickup>(Active.Target.Get());H&&H->CanEquip(P)){H->TryEquip(P);Release();return;}
    if(auto* D=Cast<AEtcPortalDoor>(Active.Target.Get());D&&Distance<250&&D->CanOfferTravelTo(P)){D->RequestTravel(P);Release();return;}
    if(auto* C=Cast<AEtcLootChest>(Active.Target.Get());C&&Distance<190&&FMath::Abs(P->GetActorLocation().Z-C->GetActorLocation().Z)<180&&Visible(P,C)){C->TryOpen(P);Release();return;}
    if(Active.Kind==TEXT("cover")&&Distance<80){ReleaseInputs();return;}
    Move(W,P,Active.Goal,Dt,Time);
  }
}
bool Tick(float Dt){
  const double Time=Now();
  if(Time>=NextSession){NextSession=Time+500;auto C=Read(Directory/TEXT("session.json"));
    if(C&&Num(C,TEXT("version"))==3&&Num(C,TEXT("processId"))==FPlatformProcess::GetCurrentProcessId()&&Num(C,TEXT("expiresAt"))>Time&&Num(C,TEXT("expiresAt"))<Time+5000&&Str(C,TEXT("token")).Len()==64){
      if(Session!=Str(C,TEXT("session"))){Release();Session=Str(C,TEXT("session"));Token=Str(C,TEXT("token"));Epoch=0;Ack=0;Frame=0;Mode=TEXT("manual");}SessionUntil=Num(C,TEXT("expiresAt"));
    }
  }
  if(Session.IsEmpty()||Time>SessionUntil){Release();Mode=TEXT("manual");return true;}
  UWorld* W=World();auto* PC=W?W->GetFirstPlayerController():nullptr;APawn* P=PC?PC->GetPawn():nullptr;
  if(OwnedPawn.Get()!=P){Release();OwnedPawn=P;}
  if(Time>=NextState){Observe(W,PC,P,Time);NextState=Time+50;Receive(P,Now());}
  Execute(W,PC,P,FMath::Clamp(Dt,0.f,0.05f),Now());return true;
}
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
