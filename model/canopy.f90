! ======================================================================
!  CANOPY - leaf area development, senescence and light interception.
!
!  The 1998 GROWTH routine drew the whole leaf-area curve as a single
!  sine between emergence and maturity.  It is smooth and it peaks in
!  about the right place, but it ties leaf area rigidly to the season
!  length and it carries green leaf right up to maturity, which is not
!  what the crop does - the canopy senesces through grain filling as
!  nitrogen and assimilate are pulled into the ear.  This module builds
!  leaf area up on the thermal-time clock during the vegetative phase
!  and then senesces it during grain filling, so the intercepting area
!  and the grain sink move in opposite directions the way they should.
!
!  Leaf area is grown as a state variable (carried day to day) rather
!  than evaluated as a closed form, so that a water-stressed expansion
!  on one day is not silently recovered on the next.  The growth side
!  passes the day's water-stress factor in and expansion is throttled by
!  it; senescence is not, and in fact accelerates under stress.
!
!  K. Osei, 2013-04-02.  Expansion rate and senescence onset fitted to
!  the 1988-2001 leaf-area subsample; extinction coefficient shared with
!  the params module (KEXT).
! ======================================================================
module canopy
   use crop_params, only : KEXT, LAIMAX
   use phenology,   only : pheno_t, STAGE_VEG, STAGE_GRAINFIL, STAGE_MATURE
   implicit none
   private

   ! Thermal time (from emergence) over which leaf area expands from
   ! zero to its potential maximum during the vegetative phase.  Held
   ! just short of anthesis so the canopy is full when the ear forms.
   real, parameter, public :: TT_LAI_FULL = 850.0

   ! Fraction of the potential maximum leaf area retained at maturity;
   ! the canopy senesces from full down to this residue through grain
   ! filling.  Not zero: there is still some green flag leaf at harvest.
   real, parameter, public :: LAI_RESIDUE = 0.10

   ! Extra senescence multiplier applied to the daily senescence rate
   ! under full water stress.  1.0 = no extra loss, >1 accelerates.
   real, parameter, public :: SEN_STRESS_GAIN = 1.8

   ! Leaf-area state carried across the day loop.
   type, public :: canopy_t
      real :: lai      = 0.0     ! current green leaf area index
      real :: lai_peak = 0.0     ! highest LAI reached (for senescence base)
   end type canopy_t

   public :: canopy_reset
   public :: canopy_update
   public :: light_interception
   public :: fpar

contains

   ! Zero a canopy at the start of a run.
   subroutine canopy_reset(cp)
      type(canopy_t), intent(out) :: cp
      cp%lai      = 0.0
      cp%lai_peak = 0.0
   end subroutine canopy_reset

   ! -------------------------------------------------------------------
   ! Advance leaf area one day given the phenology state, the day's
   ! effective thermal time and the water-stress factor (0..1, one being
   ! unstressed).  During the vegetative phase leaf area expands toward
   ! the potential maximum in proportion to thermal time and stress;
   ! from anthesis on it senesces toward the residue, faster when
   ! stressed.  The updated LAI is left in cp%lai and returned.
   ! -------------------------------------------------------------------
   subroutine canopy_update(cp, ph, tt_eff, stress, lai_out)
      type(canopy_t), intent(inout) :: cp
      type(pheno_t),  intent(in)    :: ph
      real,           intent(in)    :: tt_eff, stress
      real,           intent(out)   :: lai_out
      real :: str, expand, target_peak, sen_rate, loss, gf

      str = stress
      if (str .lt. 0.0) str = 0.0
      if (str .gt. 1.0) str = 1.0

      if (.not. ph%emerged) then
         cp%lai = 0.0
         lai_out = cp%lai
         return
      end if

      if (ph%stage .eq. STAGE_VEG) then
         ! Linear-in-thermal-time expansion toward LAIMAX, throttled by
         ! water stress.  The daily increment is (LAIMAX/TT_LAI_FULL) per
         ! degree-day of effective thermal time.
         expand = (LAIMAX / TT_LAI_FULL) * tt_eff * str
         if (expand .lt. 0.0) expand = 0.0
         cp%lai = cp%lai + expand
         if (cp%lai .gt. LAIMAX) cp%lai = LAIMAX
         if (cp%lai .gt. cp%lai_peak) cp%lai_peak = cp%lai

      else if (ph%stage .eq. STAGE_GRAINFIL) then
         ! Senesce from the peak toward the residue over the grain-fill
         ! fraction.  gf runs 0 at anthesis to 1 at maturity.
         gf = ph%gf_frac
         if (gf .lt. 0.0) gf = 0.0
         if (gf .gt. 1.0) gf = 1.0
         target_peak = cp%lai_peak
         if (target_peak .le. 0.0) target_peak = cp%lai
         ! nominal LAI along a straight senescence line
         cp%lai = target_peak * (1.0 - gf * (1.0 - LAI_RESIDUE))
         ! stress accelerates senescence: pull an extra bit off
         sen_rate = (1.0 - str) * (SEN_STRESS_GAIN - 1.0)
         loss = cp%lai * sen_rate * 0.02
         cp%lai = cp%lai - loss
         if (cp%lai .lt. target_peak * LAI_RESIDUE) &
              cp%lai = target_peak * LAI_RESIDUE

      else if (ph%stage .eq. STAGE_MATURE) then
         cp%lai = cp%lai_peak * LAI_RESIDUE
      else
         cp%lai = 0.0
      end if

      if (cp%lai .lt. 0.0) cp%lai = 0.0
      lai_out = cp%lai
   end subroutine canopy_update

   ! -------------------------------------------------------------------
   ! Fraction of incident light intercepted by a canopy of a given leaf
   ! area, Beer's law with the shared extinction coefficient.
   ! -------------------------------------------------------------------
   real function light_interception(lai)
      real, intent(in) :: lai
      real :: l
      l = lai
      if (l .lt. 0.0) l = 0.0
      light_interception = 1.0 - exp(-KEXT * l)
      if (light_interception .lt. 0.0) light_interception = 0.0
      if (light_interception .gt. 1.0) light_interception = 1.0
   end function light_interception

   ! Alias kept for the growth side, which historically called the
   ! intercepted fraction FPAR (fraction of PAR absorbed).
   real function fpar(lai)
      real, intent(in) :: lai
      fpar = light_interception(lai)
   end function fpar

end module canopy
