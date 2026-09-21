#include "../integrations/etc/EtcCombatLoadout.h"
#include "../integrations/etc/EtcViewMotion.h"
#include <cassert>
#include <iostream>
int main()
{
    using namespace EtcCombatLoadout;
    assert(Classify(L"ID_ETC_SMG01_C")==Weapon::Smg);
    assert(Classify(L"ID_ETC_LMG01_C")==Weapon::MachineGun);
    assert(Classify(L"ID_ETC_StarterPistol_C")==Weapon::Sidearm);
    assert(Utility(Weapon::Rifle,30,30,900,false)>Utility(Weapon::Sniper,5,0,900,true));
    assert(Utility(Weapon::Sniper,5,0,4500,false)>Utility(Weapon::Rifle,30,30,4500,true));
    assert(Utility(Weapon::Sidearm,10,0,900,false)>Utility(Weapon::Rifle,0,30,900,true));
    assert(Utility(Weapon::Rifle,30,30,400,false)>Utility(Weapon::Launcher,3,1,400,true));
    assert(Utility(Weapon::Sniper,0,0,4500,true)<-999);
    assert(HoldRange(Weapon::Shotgun)<HoldRange(Weapon::Rifle));
    for(double Hz:{30.,60.,120.}){
        EtcViewMotion::Axis Old,Follow;double OldAngle=0,Angle=0,Speed=0;
        for(int I=0;I<int(Hz*4);++I){
            const double Target=12.0*(I+1)/Hz,Before=Angle;
            OldAngle=Old.Step(OldAngle,Target,1./Hz,240,1150);
            Angle=Follow.Step(Angle,Target,1./Hz,240,1150,12);
            assert(std::abs(EtcViewMotion::Wrap(Angle-Before))<=240./Hz+.001);
            assert(std::abs(Follow.Velocity-Speed)<=1150./Hz+.001);Speed=Follow.Velocity;
        }
        const double Error=std::abs(EtcViewMotion::Wrap(48-Angle));
        std::cout<<Hz<<" Hz: prior tracking error="<<48-OldAngle<<", compensated="<<Error<<" degrees\n";
        assert(Error<.45);assert(48-OldAngle>2);
        const double Before=Angle;Angle=Follow.Step(Angle,-150,1,240,1150,-160);
        assert(std::abs(EtcViewMotion::Wrap(Angle-Before))<=12.001);
        Follow.Reset();assert(Follow.Velocity==0);
    }
    std::cout<<"PASS: weapon choice, loaded fallback, launcher stand-off, tracked camera constraints\n";
}
