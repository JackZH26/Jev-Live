// Shared navigation adapter: preserve the player controller and reuse UE path following.
#pragma once

#include "AIController.h"
#include "AI/EtcBotController.h"
#include "AI/EtcBotAimComponent.h"
#include "Development/EtcJevBridge.h"
#include "GameFramework/PlayerController.h"
#include "Navigation/PathFollowingComponent.h"
#include "NavigationSystem.h"

namespace EtcJevController
{
// Room providers can keep a direct-drive route between Brain ticks. It must not
// exclude an automatic player, or continue driving one after manual takeover.
inline bool MayDrivePawn(const APawn* Pawn)
{
    if (!Pawn) return false;
    if (!Pawn->IsPlayerControlled()) return true;
    return EtcJevBridge::HasControlLease(Pawn);
}
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
// The player adapter's path may end at a hazard waypoint. Predict against a
// fresh route to the tactical goal, not a straight line through cover geometry.
inline FVector NextPathCorner(AController* Controller, const FVector& Goal)
{
    static TWeakObjectPtr<AController> CachedController;
    static FVector CachedGoal, CachedCorner;
    static double Until=0;
    const double Now=FPlatformTime::Seconds();
    if(Controller==CachedController.Get() && Now<Until && FVector::DistSquared(Goal,CachedGoal)<3600)
        return CachedCorner;
    CachedController=Controller;CachedGoal=Goal;CachedCorner=Goal;Until=Now+.25;
    if(!Controller||!Controller->GetPawn())return Goal;
    auto* Nav=FNavigationSystem::GetCurrent<UNavigationSystemV1>(Controller->GetWorld());
    const FVector Start=Controller->GetNavAgentLocation();
    const auto* Data=Nav?Nav->GetNavDataForProps(Controller->GetNavAgentPropertiesRef(),Start):nullptr;
    if(!Data)return Goal;
    FNavLocation Projected;
    if(!Nav->ProjectPointToNavigation(Goal,Projected,FVector(500,500,700),Data))return Goal;
    FPathFindingQuery Query(Controller,*Data,Start,Projected.Location);Query.SetAllowPartialPaths(false);
    const auto Result=Nav->FindPathSync(Query);
    if(Result.IsSuccessful()&&Result.Path.IsValid()&&Result.Path->GetPathPoints().Num()>1)
        CachedCorner=Result.Path->GetPathPoints()[1].Location;
    return CachedCorner;
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
