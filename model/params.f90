! ======================================================================
!  PARAMS - cultivar and physical parameters for the Meridian cropmod.
!
!  Historically these lived as PARAMETER statements scattered through
!  WATBAL and GROWTH.  They were gathered here in 2009 so the two sides
!  of the model could at least agree on the constants, though they
!  still disagree on how the water stress fraction is formed (MRD-204).
!
!  M. Chen, 2009-05-18.  Base temperature and RUE re-fitted by
!  K. Osei against the 1971-2001 trial set; do not change without a
!  re-validation run (there is no harness for that, see MRD-231).
! ======================================================================
module crop_params
   implicit none
   public

   ! ---- physical constants -------------------------------------------
   real, parameter :: PI       = 3.14159265
   real, parameter :: PSYCHRO  = 0.0665     ! psychrometric constant, kPa/degC
   real, parameter :: PT_ALPHA = 1.26       ! Priestley-Taylor coefficient
   real, parameter :: LAMBDA   = 2.45       ! latent heat of vaporisation, MJ/kg
   real, parameter :: STEFAN   = 4.903e-9   ! Stefan-Boltzmann, MJ/K4/m2/day
   real, parameter :: SOLARC   = 0.0820     ! solar constant, MJ/m2/min

   ! ---- canopy / radiation -------------------------------------------
   real, parameter :: ALBEDO   = 0.23       ! reference crop albedo
   real, parameter :: KEXT     = 0.55       ! canopy extinction coefficient
   real, parameter :: LAIMAX   = 5.2        ! maximum leaf area index
   real, parameter :: SLA      = 22.0       ! specific leaf area, m2/kg

   ! ---- phenology (thermal time, degC-day) ---------------------------
   real, parameter :: TBASE    = 5.0        ! base temperature
   real, parameter :: TOPT     = 26.0       ! optimum temperature
   real, parameter :: TMAXDEV  = 34.0       ! ceiling temperature
   real, parameter :: TT_EMERG = 120.0      ! sowing -> emergence
   real, parameter :: TT_ANTH  = 900.0      ! emergence -> anthesis
   real, parameter :: TT_MAT   = 1450.0     ! emergence -> maturity

   ! ---- growth -------------------------------------------------------
   real, parameter :: RUE0     = 1.62       ! radiation use efficiency, g/MJ
   real, parameter :: HINDEX   = 0.48       ! potential harvest index
   real, parameter :: WSTRESS_THRESH = 0.5  ! fraction below which stress bites

   ! A cultivar carries the handful of parameters agronomy actually
   ! adjusts between varieties.  Only WHEAT_DEFAULT is wired in; the
   ! type exists so the 2019 "multi-cultivar" branch had somewhere to
   ! land.  That branch never merged.
   type cultivar_t
      character(len=16) :: name
      real :: tt_maturity
      real :: rue
      real :: harvest_index
      real :: laimax
   end type cultivar_t

contains

   pure function wheat_default() result(cv)
      type(cultivar_t) :: cv
      cv%name          = 'WHEAT-DEFAULT'
      cv%tt_maturity   = TT_MAT
      cv%rue           = RUE0
      cv%harvest_index = HINDEX
      cv%laimax        = LAIMAX
   end function wheat_default

end module crop_params
