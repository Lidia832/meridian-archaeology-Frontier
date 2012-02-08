! ======================================================================
!  SNOW - degree-day snow accumulation and melt.
!
!  The deck starts in the spring for most stations, but not all of them,
!  and the early-season records from the northern sites carry real snow.
!  The 1994 balance counted a snowy day's "precipitation" as if it were
!  rain and infiltrated it on the spot, which put water into the profile
!  weeks before the melt actually delivered it.  This module holds a
!  snowpack: cold-day precipitation accumulates as snow water equivalent
!  and is released later as meltwater by a degree-day rule.  WATBAL adds
!  the meltwater to the day's liquid rain before it reaches the runoff
!  and infiltration steps.
!
!  Degree-day melt is the crudest defensible scheme and the only one the
!  daily deck can support - there is no radiation-index information in
!  MERIDIAN.DAT beyond shortwave, and no snow observations to fit
!  anything richer against.  The melt factor is a mid-range literature
!  value for open ground.
!
!  K. Osei, 2012-02-08.  Rain/snow split after the USACE dual-threshold
!  form; melt factor from Hock (2003) review, open-site midpoint.
! ======================================================================
module snow
   implicit none
   private

   ! Air temperature at or below which all precipitation falls as snow,
   ! and at or above which all of it falls as rain.  Between the two the
   ! split is linear in temperature.
   real, parameter, public :: TSNOW_ALL = 0.0    ! degC, all snow at/below
   real, parameter, public :: TRAIN_ALL = 2.0    ! degC, all rain at/above

   ! Degree-day melt factor, mm SWE per degC per day above the melt base.
   real, parameter, public :: MELT_FACTOR = 3.5

   ! Temperature above which melt is generated.
   real, parameter, public :: TMELT_BASE = 0.0

   ! A snowpack state.  WATBAL keeps one of these across the day loop.
   type, public :: snowpack_t
      real :: swe = 0.0        ! snow water equivalent, mm
      real :: age = 0.0        ! days since last accumulation (unused in
                               ! the melt law, carried for diagnostics)
   end type snowpack_t

   public :: snow_fraction
   public :: rain_part
   public :: snow_part
   public :: potential_melt
   public :: snow_reset
   public :: snow_step

contains

   ! -------------------------------------------------------------------
   ! Fraction of a day's precipitation that falls as SNOW given the mean
   ! air temperature.  1.0 when cold, 0.0 when warm, linear between the
   ! two thresholds.
   ! -------------------------------------------------------------------
   real function snow_fraction(tavg)
      real, intent(in) :: tavg
      if (tavg .le. TSNOW_ALL) then
         snow_fraction = 1.0
      else if (tavg .ge. TRAIN_ALL) then
         snow_fraction = 0.0
      else
         snow_fraction = (TRAIN_ALL - tavg) / (TRAIN_ALL - TSNOW_ALL)
      end if
      if (snow_fraction .lt. 0.0) snow_fraction = 0.0
      if (snow_fraction .gt. 1.0) snow_fraction = 1.0
   end function snow_fraction

   ! Liquid (rain) part of a day's precipitation, mm.
   real function rain_part(precip, tavg)
      real, intent(in) :: precip, tavg
      real :: p
      p = precip
      if (p .lt. 0.0) p = 0.0
      rain_part = p * (1.0 - snow_fraction(tavg))
   end function rain_part

   ! Frozen (snow) part of a day's precipitation, mm SWE.
   real function snow_part(precip, tavg)
      real, intent(in) :: precip, tavg
      real :: p
      p = precip
      if (p .lt. 0.0) p = 0.0
      snow_part = p * snow_fraction(tavg)
   end function snow_part

   ! -------------------------------------------------------------------
   ! Potential degree-day melt for a day, mm SWE, before it is capped by
   ! the pack that is actually there.
   ! -------------------------------------------------------------------
   real function potential_melt(tavg)
      real, intent(in) :: tavg
      if (tavg .gt. TMELT_BASE) then
         potential_melt = MELT_FACTOR * (tavg - TMELT_BASE)
      else
         potential_melt = 0.0
      end if
      if (potential_melt .lt. 0.0) potential_melt = 0.0
   end function potential_melt

   ! Zero a snowpack (start of a run).
   subroutine snow_reset(pack)
      type(snowpack_t), intent(out) :: pack
      pack%swe = 0.0
      pack%age = 0.0
   end subroutine snow_reset

   ! -------------------------------------------------------------------
   ! Advance the snowpack one day.
   !
   !   in : precip (mm), tavg (degC), current pack
   !   out: liquid  - water reaching the ground this day, mm
   !                  (rainfall plus any melt)
   !        pack    - updated snow water equivalent
   !
   ! Snowfall is added to the pack; melt is drawn from it and released
   ! together with the day's rainfall.  On a warm day with no pack the
   ! liquid is simply the rain, so on decks that never see snow this
   ! module is transparent.
   ! -------------------------------------------------------------------
   subroutine snow_step(precip, tavg, pack, liquid)
      real,             intent(in)    :: precip, tavg
      type(snowpack_t), intent(inout) :: pack
      real,             intent(out)   :: liquid
      real :: rain, snew, pmelt, melt

      rain = rain_part(precip, tavg)
      snew = snow_part(precip, tavg)

      ! accumulate new snow
      pack%swe = pack%swe + snew
      if (snew .gt. 0.0) then
         pack%age = 0.0
      else
         pack%age = pack%age + 1.0
      end if

      ! melt, capped by the pack present after accumulation
      pmelt = potential_melt(tavg)
      melt  = pmelt
      if (melt .gt. pack%swe) melt = pack%swe
      pack%swe = pack%swe - melt
      if (pack%swe .lt. 0.0) pack%swe = 0.0

      liquid = rain + melt
      if (liquid .lt. 0.0) liquid = 0.0
   end subroutine snow_step

end module snow
