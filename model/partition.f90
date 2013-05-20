! ======================================================================
!  PARTITION - dry-matter partitioning and grain yield.
!
!  The 1998 GROWTH routine accumulated a single biomass pool and, at the
!  very end, multiplied it by a fixed harvest index of 0.48 to get
!  yield.  That is a reasonable long-run average and a poor description
!  of any one season: a crop that runs short of thermal time never fills
!  its grain, and a fixed index cannot show that.  This module keeps the
!  daily assimilate split across three pools - leaf, stem and grain -
!  with the split moving through the season, and forms yield from the
!  grain pool that actually accumulated.
!
!  Before anthesis nothing goes to grain: assimilate builds leaf and
!  stem.  From anthesis on, the grain fraction climbs and the vegetative
!  fractions fall, and a portion of the stem reserve is remobilised into
!  the grain so that a late-season shortfall in current assimilate does
!  not starve the ear outright.  The harvest index this produces is an
!  OUTCOME - grain over total - not an input, which is the point.
!
!  K. Osei, 2013-05-20.  Partition fractions read off the 1971-1996
!  component-harvest notes; stem remobilisation fraction (REMOB) is a
!  round number, there is no data to fit it and it moves yield by only a
!  few per cent.
! ======================================================================
module partition
   use crop_params, only : HINDEX
   use phenology,   only : pheno_t, STAGE_PRESOW, STAGE_VEG, &
                           STAGE_GRAINFIL, STAGE_MATURE
   implicit none
   private

   ! Vegetative-phase split between leaf and stem (they take everything
   ! before anthesis).  Leaf-heavy early, more stem as the crop bulks up
   ! - here we use a single representative split; the season-long canopy
   ! shape is carried by the CANOPY module, not by this ratio.
   real, parameter, public :: FRLEAF_VEG = 0.55
   real, parameter, public :: FRSTEM_VEG = 0.45

   ! Maximum fraction of daily assimilate routed to grain at the height
   ! of grain filling.  The rest continues to stem (structural) so the
   ! plant does not collapse.
   real, parameter, public :: FRGRAIN_MAX = 0.80

   ! Fraction of the stem pool that can be remobilised to grain over the
   ! whole grain-fill period.  Drawn down in proportion to grain-fill
   ! progress.
   real, parameter, public :: REMOB = 0.15

   ! A dry-matter budget carried across the day loop.
   type, public :: dm_pools_t
      real :: leaf  = 0.0    ! g m-2
      real :: stem  = 0.0    ! g m-2
      real :: grain = 0.0    ! g m-2
      real :: remob_done = 0.0   ! stem already remobilised, g m-2
   end type dm_pools_t

   public :: pools_reset
   public :: grain_fraction
   public :: partition_day
   public :: total_biomass
   public :: harvest_index
   public :: grain_yield

contains

   ! Zero the pools at the start of a run.
   subroutine pools_reset(dm)
      type(dm_pools_t), intent(out) :: dm
      dm%leaf       = 0.0
      dm%stem       = 0.0
      dm%grain      = 0.0
      dm%remob_done = 0.0
   end subroutine pools_reset

   ! -------------------------------------------------------------------
   ! Fraction of the day's assimilate routed to grain, given the
   ! grain-fill fraction gf (0 at anthesis, 1 at maturity).  Rises fast
   ! after anthesis, plateaus near FRGRAIN_MAX, and eases off right at
   ! the end as the grain approaches physiological maturity.  A smooth
   ! hump keeps the daily increment from jumping.
   ! -------------------------------------------------------------------
   real function grain_fraction(gf)
      real, intent(in) :: gf
      real :: g
      g = gf
      if (g .lt. 0.0) g = 0.0
      if (g .gt. 1.0) g = 1.0
      ! quarter-sine rise to the plateau over the first ~40% of fill,
      ! then hold, then a mild taper over the last ~15%
      if (g .le. 0.40) then
         grain_fraction = FRGRAIN_MAX * sin(1.5707963 * (g / 0.40))
      else if (g .le. 0.85) then
         grain_fraction = FRGRAIN_MAX
      else
         grain_fraction = FRGRAIN_MAX * (1.0 - 0.5 * (g - 0.85) / 0.15)
      end if
      if (grain_fraction .lt. 0.0) grain_fraction = 0.0
      if (grain_fraction .gt. 1.0) grain_fraction = 1.0
   end function grain_fraction

   ! -------------------------------------------------------------------
   ! Partition one day's new assimilate DB (g m-2) into the pools using
   ! the current phenology state, and apply stem remobilisation to grain
   ! during grain filling.  DB may be zero (dark, or fully stressed) and
   ! must never be negative; remobilisation can still add grain on such
   ! a day, which is the whole reason it is here.
   ! -------------------------------------------------------------------
   subroutine partition_day(dm, ph, db)
      type(dm_pools_t), intent(inout) :: dm
      type(pheno_t),    intent(in)    :: ph
      real,             intent(in)    :: db
      real :: assim, frg, frl, frs, to_grain, to_stem, to_leaf
      real :: remob_target, remob_now

      assim = db
      if (assim .lt. 0.0) assim = 0.0

      if (ph%stage .eq. STAGE_PRESOW) then
         ! nothing standing yet; assimilate is negligible pre-emergence
         return

      else if (ph%stage .eq. STAGE_VEG) then
         to_leaf = assim * FRLEAF_VEG
         to_stem = assim * FRSTEM_VEG
         dm%leaf = dm%leaf + to_leaf
         dm%stem = dm%stem + to_stem

      else if (ph%stage .eq. STAGE_GRAINFIL) then
         frg = grain_fraction(ph%gf_frac)
         ! whatever is not grain keeps the structure going, split in the
         ! vegetative ratio
         frl = (1.0 - frg) * FRLEAF_VEG
         frs = (1.0 - frg) * FRSTEM_VEG
         to_grain = assim * frg
         to_leaf  = assim * frl
         to_stem  = assim * frs
         dm%grain = dm%grain + to_grain
         dm%leaf  = dm%leaf  + to_leaf
         dm%stem  = dm%stem  + to_stem

         ! Remobilise stem reserve to grain, drawn down toward the total
         ! allowance REMOB*stem over the course of grain fill.
         remob_target = REMOB * dm%stem * ph%gf_frac
         remob_now    = remob_target - dm%remob_done
         if (remob_now .lt. 0.0) remob_now = 0.0
         if (remob_now .gt. dm%stem) remob_now = dm%stem
         dm%stem       = dm%stem  - remob_now
         dm%grain      = dm%grain + remob_now
         dm%remob_done = dm%remob_done + remob_now

      else if (ph%stage .eq. STAGE_MATURE) then
         ! development finished: no further partitioning, grain is set
         return
      end if
   end subroutine partition_day

   ! Total above-ground dry matter, g m-2.
   real function total_biomass(dm)
      type(dm_pools_t), intent(in) :: dm
      total_biomass = dm%leaf + dm%stem + dm%grain
      if (total_biomass .lt. 0.0) total_biomass = 0.0
   end function total_biomass

   ! -------------------------------------------------------------------
   ! Realised harvest index: grain over total above-ground dry matter.
   ! This is a diagnostic OUTPUT of the run, not the fixed 0.48 the old
   ! routine assumed.  Falls back on the nominal HINDEX only when there
   ! is no standing biomass at all, purely to avoid a divide by zero.
   ! -------------------------------------------------------------------
   real function harvest_index(dm)
      type(dm_pools_t), intent(in) :: dm
      real :: tot
      tot = total_biomass(dm)
      if (tot .le. 0.0) then
         harvest_index = HINDEX
      else
         harvest_index = dm%grain / tot
      end if
      if (harvest_index .lt. 0.0) harvest_index = 0.0
      if (harvest_index .gt. 1.0) harvest_index = 1.0
   end function harvest_index

   ! -------------------------------------------------------------------
   ! Grain yield, t ha-1, from the grain pool.  The grain pool is in
   ! g m-2; the 0.01 converts g m-2 to t ha-1 (the same factor the 1998
   ! routine applied to biomass*HI, so the units of the reported YIELD
   ! are unchanged).
   ! -------------------------------------------------------------------
   real function grain_yield(dm)
      type(dm_pools_t), intent(in) :: dm
      grain_yield = dm%grain * 0.01
      if (grain_yield .lt. 0.0) grain_yield = 0.0
   end function grain_yield

end module partition
