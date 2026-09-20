#include "Development/EtcJevMotor.h"
#include "Misc/AutomationTest.h"

#if WITH_DEV_AUTOMATION_TESTS
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FEtcJevMotorTest,"Project.ETC.Jev.PlayerMotor",
  EAutomationTestFlags::EditorContext|EAutomationTestFlags::EngineFilter)
bool FEtcJevMotorTest::RunTest(const FString& Parameters){
  using namespace EtcJevMotor;
  TestTrue(TEXT("Fresh lease accepted"),AcceptCommand(2,1,4,4,1200,1000,10,11,false));
  TestFalse(TEXT("Old epoch rejected"),AcceptCommand(2,1,3,4,1200,1000,10,11,false));
  TestFalse(TEXT("Duplicate rejected"),AcceptCommand(1,1,4,4,1200,1000,10,11,false));
  TestFalse(TEXT("Stale observation rejected"),AcceptCommand(2,1,4,4,1200,1000,5,11,false));
  TestFalse(TEXT("Future observation rejected"),AcceptCommand(2,1,4,4,1200,1000,12,11,false));
  TestFalse(TEXT("Missing frame rejected"),AcceptCommand(2,1,4,4,1200,1000,-1,1,false));
  TestFalse(TEXT("Expired lease rejected"),AcceptCommand(2,1,4,4,999,1000,10,11,false));
  TestFalse(TEXT("Unbounded lease rejected"),AcceptCommand(2,1,4,4,2000,1000,10,11,false));
  TestTrue(TEXT("Manual release ignores observation age"),AcceptCommand(2,1,5,4,1200,1000,0,11,true));
  TestFalse(TEXT("Reaction floor"),CanFire(1149,1000,0,true,false,10));
  TestTrue(TEXT("Acquired target"),CanFire(1150,1000,0.2f,true,false,10));
  TestFalse(TEXT("Occlusion"),CanFire(1500,1000,0,false,false,10));
  TestFalse(TEXT("Spawn protection"),CanFire(1500,1000,0,true,true,10));
  TestFalse(TEXT("Empty weapon"),CanFire(1500,1000,0,true,false,0));
  TestFalse(TEXT("Aim outside gate"),CanFire(1500,1000,1,true,false,10));
  const FRotator Step=AimStep(FRotator::ZeroRotator,FRotator(0,180,0),1.f/60);
  TestTrue(TEXT("360 degrees/s limit at 60 Hz"),FMath::Abs(Step.Yaw)<=6.01f);
  const FRotator Wrap=AimStep(FRotator(0,179,0),FRotator(0,-179,0),1.f/60);
  TestTrue(TEXT("Shortest arc across 180"),FMath::Abs(FMath::FindDeltaAngleDegrees(Wrap.Yaw,-179.f))<0.01f);
  const FRotator Hitch=AimStep(FRotator::ZeroRotator,FRotator(0,180,0),1.f);
  TestTrue(TEXT("Frame hitch cannot snap"),FMath::Abs(Hitch.Yaw)<=18.01f);
  return true;
}
#endif
