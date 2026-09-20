// Shared navigation adapter: preserve the player controller and reuse UE path following.
#pragma once

#include "AIController.h"
#include "AI/EtcBotController.h"
#include "AI/EtcBotAimComponent.h"
#include "GameFramework/PlayerController.h"
#include "Navigation/PathFollowingComponent.h"
#include "NavigationSystem.h"

namespace EtcJevController
{
inline UEtcBotAimComponent* Aim(const AController* Controller)
{
    return Controller ? Controller->FindComponentByClass<UEtcBotAimComponent>() : nullptr;
}
inline UPathFollowingComponent* Path(AController* Controller, bool bCreate = false)
{
    if (!Controller) return nullptr;
    if (auto* AI = Cast<AAIController>(Controller)) return AI->GetPathFollowingComponent();
    auto* Follow = Controller->FindComponentByClass<UPathFollowingComponent>();
    if (!Follow && bCreate)
    {
        Follow = NewObject<UPathFollowingComponent>(Controller);
        Follow->RegisterComponentWithWorld(Controller->GetWorld());
        Follow->Initialize();
    }
    return Follow;
}
inline void Stop(AController* Controller)
{
    if (!Controller) return;
    if (auto* AI = Cast<AAIController>(Controller)) { AI->StopMovement(); return; }
    if (auto* Follow = Path(Controller); Follow && Follow->GetStatus() != EPathFollowingStatus::Idle)
        Follow->AbortMove(*Controller, FPathFollowingResultFlags::ForcedScript,
            FAIRequestID::AnyRequest, EPathFollowingVelocityMode::Reset);
    Controller->StopMovement();
}
inline EPathFollowingStatus::Type Status(AController* Controller)
{
    auto* Follow = Path(Controller);
    return Follow ? Follow->GetStatus() : EPathFollowingStatus::Idle;
}
inline void AssignedSlot(AController* Controller, int32 Slot)
{
    if (auto* Bot = Cast<AEtcBotController>(Controller)) Bot->SetAssignedSlot(Slot);
}
inline EPathFollowingRequestResult::Type Move(AController* Controller, const FVector& Goal,
    float Acceptance, bool bAllowPartial)
{
    // Existing Bot behavior stays on AIController's native path.
    if (auto* AI = Cast<AAIController>(Controller))
        return AI->MoveToLocation(Goal, Acceptance, true, true, false, true, nullptr, bAllowPartial);
    auto* Nav = Controller ? FNavigationSystem::GetCurrent<UNavigationSystemV1>(Controller->GetWorld()) : nullptr;
    auto* Follow = Path(Controller, true);
    if (!Nav || !Follow || !Controller->GetPawn() || !Follow->IsPathFollowingAllowed())
        return EPathFollowingRequestResult::Failed;
    FAIMoveRequest Request(Goal);
    Request.SetAcceptanceRadius(Acceptance);
    Request.SetReachTestIncludesAgentRadius(true);
    Request.SetUsePathfinding(true);
    Request.SetAllowPartialPath(bAllowPartial);
    Request.SetProjectGoalLocation(false);
    Request.SetCanStrafe(true);
    if (Follow->HasReached(Request)) { Stop(Controller); return EPathFollowingRequestResult::AlreadyAtGoal; }
    const FVector Start = Controller->GetNavAgentLocation();
    const auto* Data = Nav->GetNavDataForProps(Controller->GetNavAgentPropertiesRef(), Start);
    if (!Data) return EPathFollowingRequestResult::Failed;
    FPathFindingQuery Query(Controller, *Data, Start, Goal);
    Query.SetAllowPartialPaths(bAllowPartial);
    const FPathFindingResult Result = Nav->FindPathSync(Query);
    if (!Result.IsSuccessful() || !Result.Path.IsValid() || (!bAllowPartial && Result.Path->IsPartial()))
        return EPathFollowingRequestResult::Failed;
    if (Follow->GetStatus() != EPathFollowingStatus::Idle)
        Follow->AbortMove(*Controller, FPathFollowingResultFlags::ForcedScript | FPathFollowingResultFlags::NewRequest,
            FAIRequestID::AnyRequest, EPathFollowingVelocityMode::Keep);
    return Follow->RequestMove(Request, Result.Path).IsValid()
        ? EPathFollowingRequestResult::RequestSuccessful : EPathFollowingRequestResult::Failed;
}
}
