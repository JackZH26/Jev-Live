// JEV Studio optional local bridge. No network listener, console evaluator or OS input injection.
// Enabled only by -JevBridgeDir, and rejects all network matches.
#include "Development/EtcJevBridge.h"
#include "Containers/Ticker.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/Character.h"
#include "GameFramework/PlayerController.h"
#include "AbilitySystemGlobals.h"
#include "AbilitySystem/LyraAbilitySystemComponent.h"
#include "Character/LyraHealthComponent.h"
#include "Kismet/GameplayStatics.h"
#include "NavigationSystem.h"
#include "NavigationPath.h"
#include "Misc/CommandLine.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/FileManager.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Rooms/EtcLootChest.h"
#include "Rooms/EtcPortalDoor.h"
#include "UI/EtcMatchFlowSubsystem.h"
#include "System/EtcMatchResultSubsystem.h"

namespace EtcJevBridge {
namespace {
FTSTicker::FDelegateHandle Handle;
FString Directory, Token, Session, Mode=TEXT("manual"), LastAction;
double Epoch=0, Ack=0, Lease=0, ActionUntil=0, NextState=0, NextRead=0, NextFire=0;
TWeakObjectPtr<APawn> OwnedPawn;
TSet<FName> Held;
struct FAction { FString Id, Label, Kind; TWeakObjectPtr<AActor> Target; FVector Goal=FVector::ZeroVector; };
TArray<FAction> Offered;
FAction Active;
FVector WanderGoal=FVector::ZeroVector;
double NextWander=0;
TWeakObjectPtr<UWorld> ObservedWorld;
bool SawLivingPlayer=false;

double Now() { return static_cast<double>(FDateTime::UtcNow().ToUnixTimestamp())*1000.0 + FDateTime::UtcNow().GetMillisecond(); }
TSharedPtr<FJsonObject> Read(const FString& File) {
  FString Text; TSharedPtr<FJsonObject> Obj;
  if(!FFileHelper::LoadFileToString(Text, *File) || Text.Len()>32768) return nullptr;
  FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text),Obj); return Obj;
}
FString Str(const TSharedPtr<FJsonObject>& O,const TCHAR* Key) { FString V; if(O) O->TryGetStringField(Key,V); return V; }
double Num(const TSharedPtr<FJsonObject>& O,const TCHAR* Key) { double V=0; if(O) O->TryGetNumberField(Key,V); return V; }
ULyraAbilitySystemComponent* ASC(APawn* P) { return P?Cast<ULyraAbilitySystemComponent>(UAbilitySystemGlobals::GetAbilitySystemComponentFromActor(P)):nullptr; }
void Release() {
  if(auto* A=ASC(OwnedPawn.Get())) for(const FName& Name:Held) A->AbilityInputTagReleased(FGameplayTag::RequestGameplayTag(Name,false));
  Held.Empty(); Active=FAction(); ActionUntil=0;
  if(auto* C=Cast<ACharacter>(OwnedPawn.Get())) C->StopJumping();
}
void Press(APawn* P,FName Name) {
  if(Held.Contains(Name)) return;
  const auto Tag=FGameplayTag::RequestGameplayTag(Name,false);
  if(auto* A=ASC(P); A && Tag.IsValid()) { A->AbilityInputTagPressed(Tag); Held.Add(Name); }
}
UWorld* World() {
  if(!GEngine) return nullptr;
  for(const FWorldContext& C:GEngine->GetWorldContexts()) if(C.World() && C.World()->IsGameWorld() && C.World()->GetNetMode()==NM_Standalone) return C.World();
  return nullptr;
}
bool Visible(APawn* P,AActor* A) {
  if(!P||!A||A==P||A->IsHidden()) return false;
  const FVector Start=P->GetPawnViewLocation(), End=A->GetActorLocation()+FVector(0,0,35);
  const FVector Dir=(End-Start).GetSafeNormal();
  if(FVector::DotProduct(P->GetViewRotation().Vector(),Dir)<0.25f) return false;
  FHitResult Hit; FCollisionQueryParams Params(SCENE_QUERY_STAT(JevVisibility),true,P); Params.AddIgnoredActor(A);
  return !P->GetWorld()->LineTraceSingleByChannel(Hit,Start,End,ECC_Visibility,Params);
}
void Offer(FString Id,FString Label,FString Kind,AActor* Target=nullptr,FVector Goal=FVector::ZeroVector) {
  Offered.Add({MoveTemp(Id),MoveTemp(Label),MoveTemp(Kind),Target,Goal});
}
void Observe(UWorld* W,APlayerController* PC,APawn* P,double Time) {
  if(ObservedWorld.Get()!=W) {ObservedWorld=W;SawLivingPlayer=false;}
  Offered.Reset();
  FString Phase=TEXT("loading"); float Health=0;
  if(W && W->GetMapName().Contains(TEXT("MainMenu"))) Phase=TEXT("menu");
  else if(P) {
    const auto* H=ULyraHealthComponent::FindHealthComponent(P); Health=H?H->GetHealth():0;
    Phase=Health>0?TEXT("playing"):TEXT("dead");
    const auto* Flow=W->GetSubsystem<UEtcMatchFlowSubsystem>();
    if(Flow && Flow->IsManagingEntry() && !Flow->HasDroppedIn()) Phase=TEXT("loading");
  }
  if(Phase==TEXT("playing"))SawLivingPlayer=true;
  if(!P && SawLivingPlayer)Phase=TEXT("dead");
  if(W) { const auto* Result=W->GetSubsystem<UEtcMatchResultSubsystem>(); if(Result && Result->HasMatchEnded()) Phase=TEXT("ended"); }
  Offer(TEXT("wait"),TEXT("Wait briefly and observe"),TEXT("wait"));
  if(Phase==TEXT("menu") || Phase==TEXT("dead") || Phase==TEXT("ended")) Offer(TEXT("new_match"),TEXT("Start a new local offline bot match"),TEXT("new_match"));
  if(Phase==TEXT("playing")) {
    const FVector Pos=P->GetActorLocation();
    for(TActorIterator<APawn> It(W);It && Offered.Num()<7;++It) {
      const auto* H=ULyraHealthComponent::FindHealthComponent(*It);
      if(*It!=P && H && H->GetHealth()>0 && FVector::DistSquared(Pos,It->GetActorLocation())<FMath::Square(6000.f) && Visible(P,*It))
        Offer(TEXT("shoot_")+It->GetName(),TEXT("Aim and fire at visible opponent ")+It->GetName(),TEXT("shoot"),*It);
    }
    for(TActorIterator<AEtcLootChest> It(W);It && Offered.Num()<14;++It) {
      if(!It->IsOpened() && FVector::DistSquared(Pos,It->GetActorLocation())<FMath::Square(3000.f) && Visible(P,*It))
        Offer(TEXT("loot_")+It->GetName(),TEXT("Approach and open visible supply chest"),TEXT("loot"),*It);
    }
    for(TActorIterator<AEtcPortalDoor> It(W);It && Offered.Num()<18;++It) {
      if(It->CanOfferTravelTo(P) && FVector::DistSquared(Pos,It->GetActorLocation())<FMath::Square(It->RevealRadius) && Visible(P,*It))
        Offer(TEXT("portal_")+It->GetName(),TEXT("Approach revealed portal and travel"),TEXT("portal"),*It);
    }
    if(Time>NextWander || FVector::DistSquared(Pos,WanderGoal)<FMath::Square(180.f)) {
      FNavLocation Dest; auto* Nav=FNavigationSystem::GetCurrent<UNavigationSystemV1>(W);
      if(Nav && Nav->GetRandomReachablePointInRadius(Pos,1600.f,Dest)) WanderGoal=Dest.Location;
      else WanderGoal=Pos+P->GetViewRotation().Vector()*300.f;
      NextWander=Time+5000;
    }
    Offer(TEXT("explore"),TEXT("Explore along a reachable navigation path"),TEXT("move"),nullptr,WanderGoal);
    Offer(TEXT("look_left"),TEXT("Scan surroundings to the left"),TEXT("left"));
    Offer(TEXT("look_right"),TEXT("Scan surroundings to the right"),TEXT("right"));
    Offer(TEXT("reload"),TEXT("Reload current weapon"),TEXT("reload"));
    Offer(TEXT("jump"),TEXT("Jump over a small obstruction"),TEXT("jump"));
  }
  auto Obj=MakeShared<FJsonObject>(); Obj->SetNumberField(TEXT("version"),1); Obj->SetNumberField(TEXT("timestamp"),Time);
  Obj->SetStringField(TEXT("session"),Session); Obj->SetStringField(TEXT("map"),W?W->GetMapName():TEXT("none"));
  Obj->SetStringField(TEXT("phase"),Phase); Obj->SetStringField(TEXT("mode"),Mode); Obj->SetNumberField(TEXT("epoch"),Epoch);
  Obj->SetNumberField(TEXT("ack"),Ack); Obj->SetNumberField(TEXT("health"),Health); Obj->SetStringField(TEXT("lastAction"),LastAction);
  TArray<TSharedPtr<FJsonValue>> Position; const FVector Pos=P?P->GetActorLocation():FVector::ZeroVector;
  for(double V:{Pos.X,Pos.Y,Pos.Z}) Position.Add(MakeShared<FJsonValueNumber>(V)); Obj->SetArrayField(TEXT("position"),Position);
  TArray<TSharedPtr<FJsonValue>> Actions;
  for(const auto& A:Offered) { auto O=MakeShared<FJsonObject>(); O->SetStringField(TEXT("id"),A.Id); O->SetStringField(TEXT("label"),A.Label); O->SetStringField(TEXT("kind"),A.Kind); Actions.Add(MakeShared<FJsonValueObject>(O)); }
  Obj->SetArrayField(TEXT("actions"),Actions);
  FString Text; FJsonSerializer::Serialize(Obj,TJsonWriterFactory<>::Create(&Text));
  const FString File=Directory/TEXT("state.json"), Temp=File+TEXT(".tmp");
  if(FFileHelper::SaveStringToFile(Text,*Temp,FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM)) IFileManager::Get().Move(*File,*Temp,true,true,false,true);
}
void Receive(APawn* P,double Time) {
  auto C=Read(Directory/TEXT("command.json"));
  if(!C || Str(C,TEXT("token"))!=Token || Str(C,TEXT("session"))!=Session) return;
  const double Id=Num(C,TEXT("id")), E=Num(C,TEXT("epoch")), Expires=Num(C,TEXT("expiresAt"));
  if(Id<=Ack || E<Epoch || Expires<Time || Expires>Time+5000) return;
  const FString Requested=Str(C,TEXT("mode"));
  if(Requested!=TEXT("manual") && Requested!=TEXT("auto")) return;
  if(E>Epoch || Requested!=Mode) Release();
  Epoch=E; Ack=Id; Mode=Requested; Lease=Expires;
  const FString Action=Str(C,TEXT("action"));
  if(Mode==TEXT("manual")) { Release(); return; }
  if(Action.IsEmpty()) return;
  const FAction* Found=Offered.FindByPredicate([&](const FAction& A){return A.Id==Action;});
  if(!Found) return;
  Release(); OwnedPawn=P; Active=*Found; ActionUntil=FMath::Min(Expires,Time+1800); LastAction=Active.Id;
}
void Execute(UWorld* W,APlayerController* PC,APawn* P,float Dt,double Time) {
  if(Mode!=TEXT("auto") || Time>Lease || Time>ActionUntil || !W || !PC) { Release(); return; }
  if(Active.Kind==TEXT("new_match")) {
    Release(); UGameplayStatics::OpenLevel(W,TEXT("/EtcCore/Maps/L_ETC_Match"),true,FString::Printf(TEXT("Experience=B_ETC_Experience_Room?MapGenSeed=%d?NumBots=19"),FMath::Rand())); return;
  }
  if(W->IsPaused()) { Release(); return; }
  if(!P || OwnedPawn.Get()!=P) { Release(); return; }
  if(Active.Kind==TEXT("left") || Active.Kind==TEXT("right")) { auto R=PC->GetControlRotation(); R.Yaw+=(Active.Kind==TEXT("left")?-1:1)*65*Dt; PC->SetControlRotation(R); }
  if(Active.Kind==TEXT("reload")) Press(P,TEXT("InputTag.Weapon.Reload"));
  if(Active.Kind==TEXT("jump")) Press(P,TEXT("InputTag.Jump"));
  if(Active.Kind==TEXT("shoot")) {
    auto* Target=Active.Target.Get();
    if(!Visible(P,Target)) { Release(); return; }
    PC->SetControlRotation((Target->GetActorLocation()+FVector(0,0,35)-P->GetPawnViewLocation()).Rotation());
    Press(P,TEXT("InputTag.Weapon.FireAuto"));
    if(Time>NextFire) { if(auto* A=ASC(P)) A->AbilityInputTagReleased(FGameplayTag::RequestGameplayTag(TEXT("InputTag.Weapon.Fire"),false)); Held.Remove(TEXT("InputTag.Weapon.Fire")); Press(P,TEXT("InputTag.Weapon.Fire")); NextFire=Time+220; }
  }
  if(Active.Kind==TEXT("move") || Active.Kind==TEXT("loot") || Active.Kind==TEXT("portal")) {
    FVector Goal=Active.Goal;
    if(Active.Kind!=TEXT("move")) { if(!Active.Target.IsValid()) { Release(); return; } Goal=Active.Target->GetActorLocation(); }
    const float Distance=FVector::Dist2D(P->GetActorLocation(),Goal);
    if(Active.Kind==TEXT("loot") && Distance<210) { if(auto* Chest=Cast<AEtcLootChest>(Active.Target.Get())) Chest->TryOpen(P); Release(); return; }
    if(Active.Kind==TEXT("portal") && Distance<240) { if(auto* Door=Cast<AEtcPortalDoor>(Active.Target.Get())) Door->RequestTravel(P); Release(); return; }
    if(auto* Path=UNavigationSystemV1::FindPathToLocationSynchronously(W,P->GetActorLocation(),Goal,P); Path && Path->PathPoints.Num()>1) Goal=Path->PathPoints[1];
    const FVector Direction=(Goal-P->GetActorLocation()).GetSafeNormal2D();
    if(!Direction.IsNearlyZero()) { PC->SetControlRotation(Direction.Rotation()); P->AddMovementInput(Direction,1.f); }
  }
}
bool Tick(float Dt) {
  const double Time=Now(); UWorld* W=World(); auto* PC=W?W->GetFirstPlayerController():nullptr; APawn* P=PC?PC->GetPawn():nullptr;
  if(OwnedPawn.Get()!=P) { Release(); OwnedPawn=P; }
  if(Time>=NextState) { Observe(W,PC,P,Time); NextState=Time+200; }
  if(Time>=NextRead) { Receive(P,Time); NextRead=Time+40; }
  Execute(W,PC,P,FMath::Min(Dt,0.1f),Time); return true;
}
}
void Install() {
  if(IsRunningCommandlet() || !FParse::Value(FCommandLine::Get(),TEXT("JevBridgeDir="),Directory)) return;
  Directory=FPaths::ConvertRelativePathToFull(Directory); auto Config=Read(Directory/TEXT("session.json"));
  Token=Str(Config,TEXT("token")); Session=Str(Config,TEXT("session"));
  if(Token.Len()!=64 || Session.IsEmpty()) return;
  Handle=FTSTicker::GetCoreTicker().AddTicker(FTickerDelegate::CreateStatic(&Tick));
}
void Uninstall() { Release(); if(Handle.IsValid()) FTSTicker::GetCoreTicker().RemoveTicker(Handle); Handle.Reset(); }
}
