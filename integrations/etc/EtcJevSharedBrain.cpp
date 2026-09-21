// External objectives reuse the normal Bot Brain execution tick, never its world strategy.
#include "AI/EtcBotBrainComponent.h"
#include "Development/EtcJevController.h"
#include "Character/LyraHealthComponent.h"
#include "Rooms/EtcLootChest.h"
#include "Rooms/EtcPortalDoor.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "System/EtcSpawnProtectionSubsystem.h"

namespace
{
double JevUtcMs()
{
    const FDateTime T = FDateTime::UtcNow();
    return double(T.ToUnixTimestamp()) * 1000.0 + T.GetMillisecond();
}
}

bool UEtcBotBrainComponent::ExternalLeaseExpired() const
{
    return bExternalControl && JevUtcMs() > ExternalUntil;
}

bool UEtcBotBrainComponent::SetExternalObjective(const FString& Id, const FString& Kind,
    AActor* Target, const FVector& Goal, double Until)
{
    auto* Controller = Cast<APlayerController>(GetOwner());
    if (!Controller || !Controller->GetPawn() || GetWorld()->GetNetMode() != NM_Standalone
        || Until <= JevUtcMs() || Until > JevUtcMs() + 500.0) return false;
    const bool bChanged = !bExternalControl || Id != ExternalId;
    // Finish a physical jump before replacing its steering. StopExternalControl
    // still releases immediately for manual takeover, focus loss or expiry.
    if (bChanged && bExternalControl && ExternalStatus == TEXT("running"))
        if (const auto* Character = Cast<ACharacter>(Controller->GetPawn());
            Character && Character->GetCharacterMovement()->IsFalling())
        { ExternalUntil = Until; return false; }
    bExternalControl = true;
    bEliminated = false;
    ExternalUntil = Until;
    if (!bChanged && (ExternalStatus == TEXT("blocked") || ExternalStatus == TEXT("succeeded"))) return false;
    if (bChanged)
    {
        ReleaseWeaponInputs(); ReleaseRotorInputs(); ReleaseLaserInputs();
        if (auto* Aim = EtcJevController::Aim(Controller)) Aim->SetTarget(nullptr);
        EtcJevController::Stop(Controller);
        TargetDoor.Reset(); TargetChest.Reset(); TargetPickup.Reset(); TargetEnemy.Reset();
        LastIssuedGoal = FVector::ZeroVector; MoveGoal = FVector::ZeroVector;
        bCoverScouting = false; bTrainWindowWaiting = false;
        // Never reset StuckAccumulator/LastProgressLocation just because tactics changed.
        ExternalStatus = TEXT("running"); ExternalReason = TEXT("accepted");
    }
    ExternalId = Id; ExternalKind = Kind; ExternalTarget = Target; ExternalGoal = Goal;
    if (bChanged) ReevaluateExternal();
    SetComponentTickEnabled(true);
    return true;
}

void UEtcBotBrainComponent::StopExternalControl(const FString& Reason)
{
    // Portal travel can release inputs before a frame hitch expires the lease.
    // Preserve the newest authoritative stop reason even after input cleanup;
    // otherwise the client cannot distinguish expiry from a manual takeover.
    if (!bExternalControl) { ExternalStatus = TEXT("released"); ExternalReason = Reason; return; }
    NotifyEliminated(); // Normal Bot cleanup releases fire, ADS, reload, traversal and movement.
    bExternalControl = false; ExternalUntil = 0;
    if(auto* Aim=EtcJevController::Aim(Cast<AController>(GetOwner())))Aim->ResetPlayerLook();
    if(bCombatCrouching)if(auto* PC=Cast<AController>(GetOwner()))if(auto* C=Cast<ACharacter>(PC->GetPawn()))C->UnCrouch();
    bCombatCrouching=false;
    ExternalStatus = TEXT("released"); ExternalReason = Reason;
    ExternalTarget.Reset();
    SetComponentTickEnabled(false);
}

void UEtcBotBrainComponent::FinishExternalObjective(const FString& Status, const FString& Reason)
{
    if (!bExternalControl || ExternalStatus != TEXT("running")) return;
    ExternalStatus = Status; ExternalReason = Reason;
    if (Status == TEXT("blocked")) ++ExternalFailures;
    ReleaseWeaponInputs(); ReleaseRotorInputs(); ReleaseLaserInputs();
    auto* Controller = Cast<AController>(GetOwner());
    if (auto* Aim = EtcJevController::Aim(Controller)) Aim->SetTarget(nullptr);
    EtcJevController::Stop(Controller);
    TargetDoor.Reset(); TargetChest.Reset(); TargetPickup.Reset(); TargetEnemy.Reset();
    MoveGoal = FVector::ZeroVector; LastIssuedGoal = FVector::ZeroVector;
    Mode = EEtcBotMode::Hold;
}

int32 UEtcBotBrainComponent::GetExternalHeldInputs() const
{
    const auto* Aim = EtcJevController::Aim(Cast<AController>(GetOwner()));
    return int32(bFireHeld) + int32(bFireAutoHeld) + int32(bReloadHeld)
        + int32(bRotorJumpPressed) + int32(bRotorCrouching) + int32(bGenericTraversalPressed)
        + int32(bHazardSprintPressed) + int32(bLaserCrouching) + int32(bLaserJumpPressed)
        + int32(bCombatCrouching)
        + (Aim ? Aim->GetHeldInputCount() : 0);
}

void UEtcBotBrainComponent::ReevaluateExternal()
{
    if (ExternalStatus != TEXT("running")) return;
    auto* Controller = Cast<APlayerController>(GetOwner());
    APawn* Pawn = Controller ? Controller->GetPawn() : nullptr;
    if (!Pawn) { StopExternalControl(TEXT("pawn_lost")); return; }
    const auto* Health = ULyraHealthComponent::FindHealthComponent(Pawn);
    if (!Health || Health->GetHealth() <= 0) { StopExternalControl(TEXT("dead")); return; }
    RefreshLoadout();
    bTargetFromDamage = false;
    TargetDoor.Reset(); TargetChest.Reset(); TargetPickup.Reset(); TargetEnemy.Reset();
    const FVector Here = Pawn->GetActorLocation();
    if (ExternalKind == TEXT("portal"))
    {
        auto* Door = Cast<AEtcPortalDoor>(ExternalTarget.Get());
        if (!Door || !Door->LinkedPortal || Door->bCollapsed || Door->LinkedPortal->bCollapsed)
        { FinishExternalObjective(TEXT("blocked"), TEXT("portal_unavailable")); return; }
        TargetDoor = Door; Mode = EEtcBotMode::Transit;
        MoveGoal = Door->GetActorLocation() + Door->GetActorForwardVector() * 190.0f;
        // Door elevation is part of the route (Room011 has four different levels).
        // Flattening it to the player's height can select the wrong abyss deck.
    }
    else if (ExternalKind == TEXT("loot"))
    {
        auto* Chest = Cast<AEtcLootChest>(ExternalTarget.Get());
        if (!Chest) { FinishExternalObjective(TEXT("blocked"), TEXT("target_unavailable")); return; }
        if (Chest->IsOpened()) { FinishExternalObjective(TEXT("succeeded"), TEXT("chest_opened")); return; }
        if (Chest->IsDeathCache()) { FinishExternalObjective(TEXT("blocked"), TEXT("manual_interaction")); return; }
        TargetChest = Chest; Mode = EEtcBotMode::Loot;
        FVector Away = (Here - Chest->GetActorLocation()).GetSafeNormal2D();
        if (Away.IsNearlyZero()) Away = -Chest->GetActorForwardVector().GetSafeNormal2D();
        MoveGoal = Chest->GetActorLocation() + Away * 140.0f;
    }
    else if (ExternalKind == TEXT("pickup"))
    {
        if (!ExternalTarget.IsValid()) { FinishExternalObjective(TEXT("blocked"), TEXT("target_unavailable")); return; }
        TargetPickup = ExternalTarget; Mode = EEtcBotMode::Loot;
        MoveGoal = ExternalTarget->GetActorLocation();
    }
    else if (ExternalKind == TEXT("engage"))
    {
        auto* Enemy = Cast<APawn>(ExternalTarget.Get());
        const auto* Protection = GetWorld()->GetSubsystem<UEtcSpawnProtectionSubsystem>();
        if (!Enemy || (Protection && (Protection->IsProtected(Pawn) || Protection->IsProtected(Enemy))))
        { FinishExternalObjective(TEXT("blocked"), TEXT("target_unavailable")); return; }
        TargetEnemy = Enemy; Mode = EEtcBotMode::Fight;
        FVector Away = (Here - Enemy->GetActorLocation()).GetSafeNormal2D();
        if (Away.IsNearlyZero()) Away = -Pawn->GetActorForwardVector().GetSafeNormal2D();
        // Fire from the reached position whenever the visible target is already
        // in effective range. Do not abandon nearby cover to hug every enemy.
        const float Range=BestWeaponRank>=5?4500.f:BestWeaponRank>=3?2600.f:1200.f;
        MoveGoal = FVector::Dist2D(Here,Enemy->GetActorLocation())<=Range && !bOutOfAmmo
            ? FVector::ZeroVector : Enemy->GetActorLocation()+Away*Range*.8f;
        if(MoveGoal.IsNearlyZero())EtcJevController::Stop(Controller);
        if (FVector::Dist(Here, Enemy->GetActorLocation()) < 200.0f) MoveGoal = Here + Away * 400.0f;
    }
    else if (ExternalKind == TEXT("cover"))
    {
        Mode = EEtcBotMode::Wander; MoveGoal = ExternalGoal;
        if (FVector::Dist2D(Here, MoveGoal) <= 100.0f && FMath::Abs(Here.Z - MoveGoal.Z) < 180.0f)
        { FinishExternalObjective(TEXT("succeeded"), TEXT("cover_reached")); return; }
    }
    else if (ExternalKind == TEXT("scan"))
    {
        Mode = EEtcBotMode::Wander;
        const bool bAtGoal = bCoverScouting && FVector::Dist2D(Here, MoveGoal) < 140.0f;
        if (bAtGoal) WanderRefresh -= 0.25f;
        if (!bCoverScouting || MoveGoal.IsNearlyZero() || (bAtGoal && WanderRefresh <= 0))
            if (!PickCoverScoutGoal()) { FinishExternalObjective(TEXT("blocked"), TEXT("no_scout_path")); return; }
    }
    else
    {
        Mode = EEtcBotMode::Hold; MoveGoal = FVector::ZeroVector;
        EtcJevController::Stop(Controller);
        if (ExternalKind == TEXT("reload") && SpareAmmo > 0) bNeedsReload = true;
    }
    if (ExternalKind != TEXT("scan")) bCoverScouting = false;
    if (auto* Aim = EtcJevController::Aim(Controller)) Aim->SetTarget(TargetEnemy.Get());
}
