// Player camera trajectory. Pure math so acceleration/wrap/hitch checks run without a world.
#pragma once
#include <cmath>
#include <algorithm>
namespace EtcViewMotion
{
inline double Wrap(double Angle) { Angle=std::fmod(Angle+180.0,360.0);if(Angle<0)Angle+=360.0;return Angle-180.0; }
struct Axis
{
    double Velocity=0;
    void Reset(){Velocity=0;}
    double Step(double Current,double Target,double Dt,double MaxSpeed=170,double MaxAcceleration=850)
    {
        if(!std::isfinite(Current)||!std::isfinite(Target)||!std::isfinite(Dt)){Reset();return std::isfinite(Current)?Current:0;}
        // A hitch must not compress an entire turn into the next rendered frame.
        double Remaining=std::clamp(Dt,0.0,0.05);
        while(Remaining>0){const double H=std::min(Remaining,1.0/120.0);Remaining-=H;
            const double Error=Wrap(Target-Current);
            // Critically damped tracking with bounded acceleration. Target changes
            // preserve velocity, so navigation/aim handovers cannot snap the view.
            const double Acceleration=std::clamp(64.0*Error-16.0*Velocity,-MaxAcceleration,MaxAcceleration);
            Velocity=std::clamp(Velocity+Acceleration*H,-MaxSpeed,MaxSpeed);
            Current=Wrap(Current+Velocity*H);
        }
        return Current;
    }
};
}
