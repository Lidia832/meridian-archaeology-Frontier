! ======================================================================
!  PHENOLOGY - thermal-time developmental stages with a photoperiod
!              modifier.
!
!  The 1998 GROWTH routine had exactly two phenological landmarks buried
!  in it: a thermal time to emergence and a thermal time to maturity,
!  with the whole canopy driven off a single sine between them.  That is
!  too coarse for the partitioning work - grain filling has to start at
!  anthesis, not at some fraction of the season - so development is
!  pulled out here as an explicit stage machine.
!
!  Development is driven by thermal time (growing degree-days above a
!  base temperature, with an optimum and a ceiling so hot days do not
!  accrue at the linear rate).  Winter and spring wheat are long-day
!  plants: short days slow development.  The photoperiod modifier
!  multiplies the day's thermal time by a factor that falls below one
!  when the daylength - taken from the WEATHER module - is under an
!  optimum photoperiod.  On the long midsummer days at this latitude the
!  modifier sits at one and does nothing, which is why the 1998 routine
!  got away without it; it bites on the early and late season shoulders.
!
!  K. Osei, 2013-03-15.  Stage thresholds re-read off the 1971-2001
!  trial phenology notes; photoperiod sensitivity is nominal (no
!  cultivar data to fit it), tunable via PP_SENS.
! ======================================================================
module phenology
   use crop_params, only : TBASE, TOPT, TMAXDEV, TT_EMERG, TT_ANTH, TT_MAT
   use weather,     only : daylength
   implicit none
   private

   ! Stage codes.  Monotone: development only ever moves forward.
   integer, parameter, public :: STAGE_PRESOW   = 0   ! before sowing/emergence
   integer, parameter, public :: STAGE_EMERGED  = 1   ! emergence -> ...
   integer, parameter, public :: STAGE_VEG      = 2   ! vegetative
   integer, parameter, public :: STAGE_ANTHESIS = 3   ! at/after anthesis
   integer, parameter, public :: STAGE_GRAINFIL = 4   ! grain filling
   integer, parameter, public :: STAGE_MATURE   = 5   ! mature, development done

   ! Optimum photoperiod (h) at and above which development runs at full
   ! rate, and the minimum photoperiod (h) below which it runs at the
   ! floor rate PP_FLOOR.  Long-day response.
   real, parameter, public :: PP_OPT   = 14.0
   real, parameter, public :: PP_MIN   = 8.0
   real, parameter, public :: PP_FLOOR = 0.55
   real, parameter, public :: PP_SENS  = 1.0    ! 0 = insensitive, 1 = full

   ! Thermal time from emergence to the start of grain filling is taken
   ! as anthesis; grain fill runs from there to maturity.
   type, public :: pheno_t
      real    :: tt_cum   = 0.0   ! cumulative thermal time from sowing
      real    :: tt_since_emg = 0.0
      integer :: stage    = STAGE_PRESOW
      real    :: gf_frac  = 0.0   ! fraction through grain fill, 0..1
      logical :: emerged  = .false.
      logical :: anthesis = .false.
      logical :: mature   = .false.
   end type pheno_t

   public :: gdd_day
   public :: photoperiod_factor
   public :: pheno_reset
   public :: pheno_advance
   public :: stage_name

contains

   ! -------------------------------------------------------------------
   ! Growing degree-days for one day, capped at an optimum and cut off
   ! at a ceiling.  Below TBASE nothing accrues; between TBASE and TOPT
   ! it is linear; between TOPT and TMAXDEV it falls back linearly to
   ! zero; above TMAXDEV nothing accrues (heat is as bad as cold for
   ! development).  This is the broken-line "beta zero" form.
   ! -------------------------------------------------------------------
   real function gdd_day(tmax, tmin)
      real, intent(in) :: tmax, tmin
      real :: tav, eff
      tav = 0.5 * (tmax + tmin)
      if (tav .le. TBASE) then
         eff = 0.0
      else if (tav .le. TOPT) then
         eff = tav - TBASE
      else if (tav .lt. TMAXDEV) then
         ! descend from (TOPT-TBASE) at TOPT to 0 at TMAXDEV
         eff = (TOPT - TBASE) * (TMAXDEV - tav) / (TMAXDEV - TOPT)
      else
         eff = 0.0
      end if
      if (eff .lt. 0.0) eff = 0.0
      gdd_day = eff
   end function gdd_day

   ! -------------------------------------------------------------------
   ! Photoperiod development-rate factor for a long-day crop, 0..1.
   ! One at and above PP_OPT, dropping linearly to PP_FLOOR at PP_MIN.
   ! PP_SENS scales the whole reduction: at 0 the factor is always one.
   ! -------------------------------------------------------------------
   real function photoperiod_factor(xlat, idoy)
      real,    intent(in) :: xlat
      integer, intent(in) :: idoy
      real :: dl, raw
      dl = daylength(xlat, idoy)
      if (dl .ge. PP_OPT) then
         raw = 1.0
      else if (dl .le. PP_MIN) then
         raw = PP_FLOOR
      else
         raw = PP_FLOOR + (1.0 - PP_FLOOR) * (dl - PP_MIN) / (PP_OPT - PP_MIN)
      end if
      ! blend toward 1.0 by the insensitivity (1 - PP_SENS)
      photoperiod_factor = 1.0 - PP_SENS * (1.0 - raw)
      if (photoperiod_factor .lt. 0.0) photoperiod_factor = 0.0
      if (photoperiod_factor .gt. 1.0) photoperiod_factor = 1.0
   end function photoperiod_factor

   ! Zero a phenology state at the start of a run.
   subroutine pheno_reset(ph)
      type(pheno_t), intent(out) :: ph
      ph%tt_cum       = 0.0
      ph%tt_since_emg = 0.0
      ph%stage        = STAGE_PRESOW
      ph%gf_frac      = 0.0
      ph%emerged      = .false.
      ph%anthesis     = .false.
      ph%mature       = .false.
   end subroutine pheno_reset

   ! -------------------------------------------------------------------
   ! Advance development one day.  Accrues photoperiod-modified thermal
   ! time, updates the cumulative totals and sets the stage.  Returns
   ! the effective (modified) thermal time added, which the canopy and
   ! partition modules reuse so all three sides see one clock.
   ! -------------------------------------------------------------------
   subroutine pheno_advance(ph, tmax, tmin, xlat, idoy, tt_eff)
      type(pheno_t), intent(inout) :: ph
      real,          intent(in)    :: tmax, tmin, xlat
      integer,       intent(in)    :: idoy
      real,          intent(out)   :: tt_eff
      real :: raw_tt, ppf

      raw_tt = gdd_day(tmax, tmin)
      ppf    = photoperiod_factor(xlat, idoy)
      tt_eff = raw_tt * ppf

      ph%tt_cum = ph%tt_cum + tt_eff
      if (ph%emerged) ph%tt_since_emg = ph%tt_since_emg + tt_eff

      ! Emergence is measured from sowing (start of deck) in absolute
      ! thermal time; everything after is measured from emergence.
      if (.not. ph%emerged) then
         if (ph%tt_cum .ge. TT_EMERG) then
            ph%emerged = .true.
            ph%tt_since_emg = ph%tt_cum - TT_EMERG
         end if
      end if

      ! Set stage from the emergence-referenced clock.
      if (.not. ph%emerged) then
         ph%stage = STAGE_PRESOW
      else if (ph%tt_since_emg .lt. TT_ANTH) then
         ph%stage = STAGE_VEG
      else if (ph%tt_since_emg .lt. TT_MAT) then
         if (.not. ph%anthesis) ph%anthesis = .true.
         ph%stage = STAGE_GRAINFIL
      else
         ph%anthesis = .true.
         ph%mature   = .true.
         ph%stage    = STAGE_MATURE
      end if

      ! Fraction through grain filling, clamped to 0..1.  Anthesis is
      ! the zero point, maturity the one point.
      if (ph%tt_since_emg .le. TT_ANTH) then
         ph%gf_frac = 0.0
      else if (ph%tt_since_emg .ge. TT_MAT) then
         ph%gf_frac = 1.0
      else
         ph%gf_frac = (ph%tt_since_emg - TT_ANTH) / (TT_MAT - TT_ANTH)
      end if
   end subroutine pheno_advance

   ! Human-readable stage label, for diagnostics only.
   function stage_name(stage) result(nm)
      integer, intent(in) :: stage
      character(len=10)   :: nm
      select case (stage)
      case (STAGE_PRESOW);   nm = 'pre-sow'
      case (STAGE_EMERGED);  nm = 'emerged'
      case (STAGE_VEG);      nm = 'vegetative'
      case (STAGE_ANTHESIS); nm = 'anthesis'
      case (STAGE_GRAINFIL); nm = 'grainfill'
      case (STAGE_MATURE);   nm = 'mature'
      case default;          nm = 'unknown'
      end select
   end function stage_name

end module phenology
