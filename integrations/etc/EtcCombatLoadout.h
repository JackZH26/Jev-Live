// Player-only tactical preferences, not weapon damage/range or enemy BOT tuning.
#pragma once
#include <string_view>
namespace EtcCombatLoadout
{
enum class Weapon { Sidearm, Shotgun, Smg, Rifle, MachineGun, Sniper, Launcher };
inline Weapon Classify(std::wstring_view Name)
{
    auto Has=[Name](std::wstring_view Part){return Name.find(Part)!=Name.npos;};
    if(Has(L"SR01"))return Weapon::Sniper;
    if(Has(L"GL01"))return Weapon::Launcher;
    // SMG01 and LMG01 also contain MG01: specificity must precede substring matches.
    if(Has(L"SMG"))return Weapon::Smg;
    if(Has(L"LMG")||Has(L"MG01"))return Weapon::MachineGun;
    if(Has(L"AR0"))return Weapon::Rifle;
    if(Has(L"SG0"))return Weapon::Shotgun;
    return Weapon::Sidearm;
}
inline float HoldRange(Weapon Gun)
{
    switch(Gun){case Weapon::Shotgun:return 800;case Weapon::Smg:return 1800;
    case Weapon::Rifle:return 3200;case Weapon::MachineGun:return 3500;
    case Weapon::Sniper:return 6500;case Weapon::Launcher:return 4000;default:return 1100;}
}
inline float MinimumFireRange(Weapon Gun){return Gun==Weapon::Launcher?900.f:0.f;}
inline float Utility(Weapon Gun,int Magazine,int Reserve,float VisibleDistance,bool Active)
{
    if(Magazine<=0&&Reserve<=0)return -10000;
    const bool Fighting=VisibleDistance>=0;
    float Score=0;
    switch(Gun){
    case Weapon::Sidearm:Score=30;break;
    case Weapon::Shotgun:Score=!Fighting?55:VisibleDistance<=850?95:VisibleDistance<=1500?48:8;break;
    case Weapon::Smg:Score=!Fighting?70:VisibleDistance<=1800?94:VisibleDistance<=3000?66:35;break;
    case Weapon::Rifle:Score=84;break;
    case Weapon::MachineGun:Score=88;break;
    case Weapon::Sniper:Score=!Fighting?65:VisibleDistance<1200?20:VisibleDistance<2600?70:108;break;
    case Weapon::Launcher:Score=!Fighting?50:VisibleDistance<MinimumFireRange(Gun)?-500:VisibleDistance<3500?78:45;break;
    }
    // A loaded fallback can win a close fight while the better gun needs a reload.
    if(Fighting&&Magazine<=0)Score-=110;
    return Score+(Active?8.f:0.f);
}
}
