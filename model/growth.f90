! ======================================================================
!  GROWTH - biomass accumulation and yield.
!  Rewritten in Fortran 90 by K. Osei, 1998-07-22, replacing the
!  original F77 routine.  The radiation use efficiency term was
!  re-fitted at that time against the 1971-1996 trial set.
!
!  2013-05-22 (K. Osei): the inline phenology (a single thermal-time
!  emergence/maturity pair) and the inline sine leaf-area curve were
!  pulled out into the PHENOLOGY and CANOPY modules, and the fixed
!  harvest index was replaced by explicit dry-matter partitioning in the
!  PARTITION module.  The daily loop below is now bookkeeping: it drives
!  those three modules off one thermal-time clock, converts intercepted
!  radiation to assimilate with the (unchanged) RUE term, and reports
!  the total standing biomass and the grain-derived yield.  The reported
!  numbers move a little from the 1998 curve because leaf area now
!  senesces through grain filling instead of being carried green to
!  maturity; this was reviewed and accepted.
!
!  Kept deliberately separate from WATBAL so the water balance can be
!  validated on its own.  The water-stress fraction is STILL formed here
!  the way it always was - SW/(AWC*100) - which does not agree with the
!  fraction WATBAL forms; that disagreement is MRD-204 and is left as it
!  is on purpose, pending the validation harness (MRD-231).
! ======================================================================
subroutine growth(n, idoy, tmax, tmin, srad, sw, awc, xlat, biom, xlai, yield)
   use crop_params, only : RUE0
   use phenology,   only : pheno_t, pheno_reset, pheno_advance
   use canopy,      only : canopy_t, canopy_reset, canopy_update, &
                           light_interception
   use partition,   only : dm_pools_t, pools_reset, partition_day, &
                           total_biomass, grain_yield
   implicit none

   integer, intent(in)  :: n
   integer, intent(in)  :: idoy(n)
   real,    intent(in)  :: tmax(n), tmin(n), srad(n), sw(n)
   real,    intent(in)  :: awc, xlat
   real,    intent(out) :: biom(n), xlai(n)
   real,    intent(out) :: yield

   integer :: i
   real    :: tt_eff, lai, fint, stress, rue, db

   type(pheno_t)    :: ph
   type(canopy_t)   :: cp
   type(dm_pools_t) :: dm

   call pheno_reset(ph)
   call canopy_reset(cp)
   call pools_reset(dm)

   do i = 1, n

      ! ---- development: advance the thermal-time / photoperiod clock --
      ! PHENOLOGY returns the day's effective (photoperiod-modified)
      ! thermal time and updates the stage machine; CANOPY and PARTITION
      ! both read the same phenology state so all three stay in step.
      call pheno_advance(ph, tmax(i), tmin(i), xlat, idoy(i), tt_eff)

      ! ---- water stress on assimilation ------------------------------
      ! Uses the same 50 percent threshold as WATBAL but computes the
      ! fraction differently because AWC here is per-unit-depth.  See
      ! MRD-204.  The first line is the historical stress fraction and
      ! must not be "corrected" to match WATBAL.
      if (awc > 0.0) then
         stress = min(sw(i) / (awc * 100.0), 1.0)
      else
         stress = 1.0
      end if
      if (stress > 0.5) then
         stress = 1.0
      else
         stress = stress / 0.5
      end if

      ! ---- leaf area and light interception --------------------------
      ! CANOPY replaces the old inline sine LAI.  Expansion is throttled
      ! by the water-stress factor; senescence runs through grain fill.
      call canopy_update(cp, ph, tt_eff, stress, lai)
      fint = light_interception(lai)

      ! ---- assimilation ----------------------------------------------
      ! Radiation use efficiency times intercepted shortwave, cut by the
      ! water-stress factor.  RUE0 is the 1998 re-fit, unchanged.
      rue = RUE0 * stress
      db  = rue * srad(i) * fint
      if (db < 0.0) db = 0.0

      ! ---- partition the day's assimilate into leaf/stem/grain -------
      call partition_day(dm, ph, db)

      biom(i) = total_biomass(dm)
      xlai(i) = lai
   end do

   ! Yield comes from the grain pool the partitioning actually built,
   ! not from a fixed harvest index applied to total biomass.  Units
   ! are t ha-1, as before.
   yield = grain_yield(dm)

end subroutine growth
