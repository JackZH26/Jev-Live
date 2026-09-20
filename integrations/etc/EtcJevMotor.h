#pragma once
#include "CoreMinimal.h"

namespace EtcJevMotor {
inline bool AcceptCommand(double Id, double Ack, double E, double Epoch, double Expires,
    double Now, double Frame, double CurrentFrame, bool bManual) {
  return FMath::IsFinite(Id) && FMath::IsFinite(E) && FMath::IsFinite(Expires)
    && FMath::IsFinite(Frame) && Id == FMath::FloorToDouble(Id) && E == FMath::FloorToDouble(E)
    && Frame == FMath::FloorToDouble(Frame) && Frame >= 0 && Id > Ack && E >= Epoch && E >= 0
    && Expires >= Now && Expires <= Now + 500
    && (bManual || (Frame <= CurrentFrame && CurrentFrame - Frame <= 5));
}
inline FRotator AimStep(const FRotator& Current, const FRotator& Desired, float Dt) {
  const FRotator Delta = (Desired - Current).GetNormalized();
  const float Limit = 360.f * FMath::Clamp(Dt, 0.f, 0.05f);
  const float Length = FMath::Sqrt(Delta.Yaw * Delta.Yaw + Delta.Pitch * Delta.Pitch);
  const float Scale = Length > Limit && Length > 0 ? Limit / Length : 1.f;
  return FRotator(FMath::Clamp(Current.Pitch + Delta.Pitch * Scale, -85.f, 85.f),
    Current.Yaw + Delta.Yaw * Scale, 0.f).GetNormalized();
}
inline bool CanFire(double Now, double FirstSeen, float Error, bool bVisible,
    bool bProtected, int32 Magazine) {
  return bVisible && !bProtected && Magazine > 0 && Now - FirstSeen >= 150 && Error <= 0.8f;
}
}
