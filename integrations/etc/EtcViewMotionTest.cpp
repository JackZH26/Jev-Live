#include "AI/EtcViewMotion.h"
#include "Misc/AutomationTest.h"
#if WITH_DEV_AUTOMATION_TESTS
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FEtcViewMotionTest,"Project.ETC.Jev.ViewMotion",EAutomationTestFlags::EditorContext|EAutomationTestFlags::EngineFilter)
bool FEtcViewMotionTest::RunTest(const FString& Parameters)
{
    for(double Hz:{30.,60.,120.}){
        EtcViewMotion::Axis Axis;double Angle=0,PreviousSpeed=0;
        for(int I=0;I<int(Hz*4);++I){const double Previous=Angle;Angle=Axis.Step(Angle,160,1./Hz);
            TestTrue(TEXT("bounded angular step"),std::abs(EtcViewMotion::Wrap(Angle-Previous))<=170./Hz+.001);
            TestTrue(TEXT("bounded acceleration"),std::abs(Axis.Velocity-PreviousSpeed)<=850./Hz+.001);PreviousSpeed=Axis.Velocity;
        }
        TestTrue(TEXT("converges at all tested render rates"),std::abs(160-Angle)<.1);
        const double Before=Angle;Angle=Axis.Step(Angle,-160,1.0);TestTrue(TEXT("hitch does not snap"),std::abs(EtcViewMotion::Wrap(Angle-Before))<=8.501);
    }
    EtcViewMotion::Axis Wrap;double Angle=179;for(int I=0;I<180;++I)Angle=Wrap.Step(Angle,-179,1./60);
    TestTrue(TEXT("crosses wrap by shortest arc"),std::abs(EtcViewMotion::Wrap(Angle+179))<.01);
    EtcViewMotion::Axis Reverse;Angle=0;for(int I=0;I<25;++I)Angle=Reverse.Step(Angle,150,1./60);
    const double Speed=Reverse.Velocity;Angle=Reverse.Step(Angle,-150,1./60);
    TestTrue(TEXT("direction switch decelerates rather than snapping velocity"),std::abs(Reverse.Velocity-Speed)<=850./60+.001);
    Reverse.Reset();TestEqual(TEXT("manual release discards velocity"),Reverse.Velocity,0.0);
    return true;
}
#endif
