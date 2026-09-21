#pragma once
class APawn;
namespace EtcJevBridge {
void Install(); void Uninstall(); bool HasControlLease(const APawn* Pawn);
void UpdateAwarenessLook(APawn* Pawn, float DeltaTime);
bool IsEnemyVisible(const APawn* Pawn, const APawn* Enemy);
}
