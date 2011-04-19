! ======================================================================
!  SOILWAT - multi-layer soil water profile for the Meridian cropmod.
!
!  The 1994 water balance carried the whole profile as a single bucket
!  (see WATBAL).  That was defensible for the Kettle Ridge trials, which
!  are on a uniform loam, but it falls apart on the layered Auburn
!  soils where drainage lags a day or two behind the top of the profile.
!  This module discretises the rooting zone into a small number of
!  layers, cascades free water downward day by day, and extracts the
!  transpiration demand by layer weighted by rooting density.
!
!  It is deliberately array based rather than object based: WATBAL is
!  still fixed-form F77 and calls these routines directly, so the
!  interfaces have to be things a 1994 routine can pass - plain REAL
!  arrays and scalars, no derived types across the boundary.  The
!  derived type PROFILE_T below is provided for the newer free-form
!  callers (the QC pass uses it) but the operational path does not.
!
!  K. Osei, 2011-04-19.  Layer count and root fractions fitted to the
!  1988-2003 neutron probe series; do not change without a re-run.
!  Amended 2011-09-02 (deep drainage coefficient, KDR).
! ======================================================================
module soilwat
   implicit none
   private

   ! ---- fixed profile geometry --------------------------------------
   ! Five layers.  The top layer is thin because that is where the
   ! infiltration front and most of the direct soil evaporation live;
   ! the layers thicken with depth.  The fractions sum to one and are
   ! applied to the total rooting depth handed in by WATBAL.
   integer, parameter, public :: NLAYERS = 5

   real, parameter, public :: LAYER_FRAC(NLAYERS) = &
        (/ 0.10, 0.15, 0.20, 0.25, 0.30 /)

   ! Rooting density fraction by layer.  Declines with depth; the
   ! numbers are a normalised exponential fitted to the probe data.
   ! They sum to one so a full transpiration demand can be met from the
   ! profile when every layer is at capacity.
   real, parameter, public :: ROOT_FRAC(NLAYERS) = &
        (/ 0.40, 0.26, 0.17, 0.11, 0.06 /)

   ! Drainage coefficient: fraction of each layer's water ABOVE field
   ! capacity that moves to the layer below in one day.  1.0 would be
   ! instantaneous cascade (the old single-bucket behaviour); 0.55 lags
   ! the front, which is what the Auburn series showed.
   real, parameter, public :: KDR = 0.55

   ! Lower limit as a fraction of field capacity below which water is
   ! held too tightly for the crop to extract (permanent wilting proxy).
   real, parameter, public :: WILT_FRAC = 0.15

   ! ---- optional object view for the free-form callers --------------
   type, public :: profile_t
      integer :: nlay = NLAYERS
      real    :: cap(NLAYERS)  = 0.0   ! field capacity per layer, mm
      real    :: wat(NLAYERS)  = 0.0   ! current water per layer, mm
      real    :: thick(NLAYERS)= 0.0   ! layer thickness, mm
   end type profile_t

   public :: sw_layer_caps
   public :: sw_init
   public :: sw_total
   public :: sw_total_extractable
   public :: sw_infiltrate
   public :: sw_uptake
   public :: sw_evaporate
   public :: sw_wetness
   public :: sw_make_profile
   public :: sw_check

contains

   ! -------------------------------------------------------------------
   ! Field capacity of each layer, mm.  AWC is the plant available water
   ! fraction (mm water per mm soil) and RDEPTH the rooting depth in mm,
   ! exactly as they arrive in the deck.  The product AWC*thickness is
   ! the plant available capacity of the layer.
   ! -------------------------------------------------------------------
   subroutine sw_layer_caps(awc, rdepth, cap)
      real, intent(in)  :: awc, rdepth
      real, intent(out) :: cap(NLAYERS)
      integer :: k
      real    :: thick
      do k = 1, NLAYERS
         thick  = LAYER_FRAC(k) * rdepth
         cap(k) = awc * thick
         if (cap(k) .le. 0.0) cap(k) = 0.001
      end do
   end subroutine sw_layer_caps

   ! -------------------------------------------------------------------
   ! Initialise the profile.  FRAC0 is the starting wetness as a
   ! fraction of field capacity (WATBAL passes 0.60, the 1994
   ! convention).  Every layer starts at the same relative wetness.
   ! -------------------------------------------------------------------
   subroutine sw_init(awc, rdepth, frac0, cap, wat)
      real, intent(in)  :: awc, rdepth, frac0
      real, intent(out) :: cap(NLAYERS), wat(NLAYERS)
      integer :: k
      real    :: f
      f = frac0
      if (f .lt. 0.0) f = 0.0
      if (f .gt. 1.0) f = 1.0
      call sw_layer_caps(awc, rdepth, cap)
      do k = 1, NLAYERS
         wat(k) = f * cap(k)
      end do
   end subroutine sw_init

   ! -------------------------------------------------------------------
   ! Total water in the profile, mm.  This is what WATBAL reports as SW
   ! and what it feeds into the (unchanged) SW/SWMAX stress fraction.
   ! -------------------------------------------------------------------
   real function sw_total(wat)
      real, intent(in) :: wat(NLAYERS)
      integer :: k
      sw_total = 0.0
      do k = 1, NLAYERS
         sw_total = sw_total + wat(k)
      end do
   end function sw_total

   ! -------------------------------------------------------------------
   ! Total EXTRACTABLE water, mm: the water above the wilting floor,
   ! summed over the profile.  Used by the uptake limiter and exposed
   ! for the growth-side stress diagnostics.
   ! -------------------------------------------------------------------
   real function sw_total_extractable(cap, wat)
      real, intent(in) :: cap(NLAYERS), wat(NLAYERS)
      integer :: k
      real    :: floor
      sw_total_extractable = 0.0
      do k = 1, NLAYERS
         floor = WILT_FRAC * cap(k)
         if (wat(k) .gt. floor) then
            sw_total_extractable = sw_total_extractable + (wat(k) - floor)
         end if
      end do
   end function sw_total_extractable

   ! -------------------------------------------------------------------
   ! Overall wetness of the profile as a fraction of total capacity.
   ! The runoff module reads this to set the antecedent moisture
   ! condition, so it lives here where the layer state lives.
   ! -------------------------------------------------------------------
   real function sw_wetness(cap, wat)
      real, intent(in) :: cap(NLAYERS), wat(NLAYERS)
      real :: tc, tw
      tc = sw_total(cap)
      tw = sw_total(wat)
      if (tc .le. 0.0) then
         sw_wetness = 0.0
      else
         sw_wetness = tw / tc
      end if
      if (sw_wetness .lt. 0.0) sw_wetness = 0.0
      if (sw_wetness .gt. 1.0) sw_wetness = 1.0
   end function sw_wetness

   ! -------------------------------------------------------------------
   ! Infiltration and drainage cascade.
   !
   ! INFIL mm of water arrives at the surface (rain plus snowmelt, less
   ! runoff - WATBAL has already done that partition).  It is added to
   ! the top layer.  Then, from the top down, any water a layer holds
   ! above its field capacity is moved to the layer below at the rate
   ! KDR per day; the residue stays as transient saturation and cascades
   ! on following days.  Whatever leaves the bottom layer is DEEP
   ! drainage and is reported by WATBAL as DRAIN.
   ! -------------------------------------------------------------------
   subroutine sw_infiltrate(cap, wat, infil, deep)
      real, intent(in)    :: cap(NLAYERS)
      real, intent(inout) :: wat(NLAYERS)
      real, intent(in)    :: infil
      real, intent(out)   :: deep
      integer :: k
      real    :: excess, move
      real    :: add

      add = infil
      if (add .lt. 0.0) add = 0.0
      wat(1) = wat(1) + add

      deep = 0.0
      do k = 1, NLAYERS
         if (wat(k) .gt. cap(k)) then
            excess = wat(k) - cap(k)
            move   = KDR * excess
            ! Anything the daily coefficient does not carry away, but
            ! which is over an absolute ceiling of 1.5x capacity, is
            ! forced on to avoid unbounded ponding on a wet spell.
            if (wat(k) - move .gt. 1.5 * cap(k)) then
               move = wat(k) - 1.5 * cap(k)
            end if
            wat(k) = wat(k) - move
            if (k .lt. NLAYERS) then
               wat(k+1) = wat(k+1) + move
            else
               deep = deep + move
            end if
         end if
      end do
   end subroutine sw_infiltrate

   ! -------------------------------------------------------------------
   ! Root water uptake to meet a transpiration demand, mm.
   !
   ! The demand is offered to each layer in proportion to the rooting
   ! density there AND the extractable water there, so a dry top layer
   ! throws its share on to the wetter layers below (compensated
   ! uptake).  ACTUAL is what the profile could actually supply; when it
   ! is less than the demand the crop is under water stress, but that
   ! judgement is left to the caller - this routine only moves water.
   ! -------------------------------------------------------------------
   subroutine sw_uptake(cap, wat, demand, actual)
      real, intent(in)    :: cap(NLAYERS)
      real, intent(inout) :: wat(NLAYERS)
      real, intent(in)    :: demand
      real, intent(out)   :: actual
      integer :: k
      real    :: avail(NLAYERS), weight(NLAYERS)
      real    :: floor, totw, want, take, remaining

      remaining = demand
      if (remaining .lt. 0.0) remaining = 0.0

      ! Availability and a first-pass weighting.
      totw = 0.0
      do k = 1, NLAYERS
         floor = WILT_FRAC * cap(k)
         avail(k) = wat(k) - floor
         if (avail(k) .lt. 0.0) avail(k) = 0.0
         weight(k) = ROOT_FRAC(k) * avail(k)
         totw = totw + weight(k)
      end do

      actual = 0.0
      if (totw .le. 0.0) return

      ! Distribute the demand by the weights, but never draw a layer
      ! below its floor.  A single pass is enough because the weights
      ! already exclude water below the floor.
      do k = 1, NLAYERS
         want = remaining * (weight(k) / totw)
         take = want
         if (take .gt. avail(k)) take = avail(k)
         wat(k) = wat(k) - take
         actual = actual + take
      end do
   end subroutine sw_uptake

   ! -------------------------------------------------------------------
   ! Direct soil evaporation from the top layer only, mm.  Bare-soil
   ! evaporation does not reach far down; the growth side never sees
   ! this, it is a within-WATBAL loss that competes with transpiration
   ! for the top of the profile.
   ! -------------------------------------------------------------------
   subroutine sw_evaporate(cap, wat, demand, actual)
      real, intent(in)    :: cap(NLAYERS)
      real, intent(inout) :: wat(NLAYERS)
      real, intent(in)    :: demand
      real, intent(out)   :: actual
      real :: floor, avail, take
      floor = WILT_FRAC * cap(1)
      avail = wat(1) - floor
      if (avail .lt. 0.0) avail = 0.0
      take = demand
      if (take .lt. 0.0) take = 0.0
      if (take .gt. avail) take = avail
      wat(1) = wat(1) - take
      actual = take
   end subroutine sw_evaporate

   ! -------------------------------------------------------------------
   ! Build a PROFILE_T for the free-form callers.  Not on the WATBAL
   ! path; here so the QC pass and any future object-oriented rewrite
   ! have a tidy handle instead of loose arrays.
   ! -------------------------------------------------------------------
   function sw_make_profile(awc, rdepth, frac0) result(p)
      real, intent(in) :: awc, rdepth, frac0
      type(profile_t)  :: p
      integer :: k
      p%nlay = NLAYERS
      call sw_init(awc, rdepth, frac0, p%cap, p%wat)
      do k = 1, NLAYERS
         p%thick(k) = LAYER_FRAC(k) * rdepth
      end do
   end function sw_make_profile

   ! -------------------------------------------------------------------
   ! Cheap invariant check used by the standalone test harness: the
   ! layer fractions and root fractions must each sum to one.  Returns
   ! .true. when the module constants are internally consistent.
   ! -------------------------------------------------------------------
   logical function sw_check()
      integer :: k
      real    :: sf, sr
      sf = 0.0
      sr = 0.0
      do k = 1, NLAYERS
         sf = sf + LAYER_FRAC(k)
         sr = sr + ROOT_FRAC(k)
      end do
      sw_check = (abs(sf - 1.0) .lt. 1.0e-4) .and. (abs(sr - 1.0) .lt. 1.0e-4)
   end function sw_check

end module soilwat
