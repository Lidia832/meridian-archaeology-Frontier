! ======================================================================
!  RUNOFF - surface runoff by the SCS curve-number method.
!
!  Until 2019 WATBAL put every millimetre of rain straight into the
!  profile.  On the heavier spring storms that overstates infiltration:
!  a good part of a 40 mm day runs off the Auburn clay before it ever
!  soaks in, and the single-bucket balance never saw it.  This module
!  partitions a day's surface water (rain plus snowmelt) into runoff and
!  infiltration using the USDA-SCS curve number, with the standard
!  antecedent-moisture adjustment driven by the current profile wetness.
!
!  The curve number itself is a soil-and-cover property.  We do not have
!  per-station cover, so the operational path uses a single CN for row
!  crop on a soil of hydrologic group C (CN2 = 82); the routine takes it
!  as an argument so the QC pass can sweep it.
!
!  D. Whitfield, 2019-05-27.  Method: SCS National Engineering Handbook
!  sec. 4; AMC curves as in Neitsch et al. (SWAT theory, 2011 ed.).
! ======================================================================
module runoff
   implicit none
   private

   ! Reference curve number for the operational path (row crop, straight
   ! row, hydrologic soil group C, average condition AMC II).
   real, parameter, public :: CN2_DEFAULT = 82.0

   ! Initial-abstraction ratio.  The classic value is 0.2; a body of
   ! later work argues for 0.05, but 0.2 is what the handbook curves are
   ! built on and what we keep for the operational number.
   real, parameter, public :: IA_RATIO = 0.20

   ! Wetness thresholds (fraction of profile capacity) that move the
   ! curve number between the three antecedent-moisture conditions.
   real, parameter, public :: AMC_DRY_BELOW = 0.35
   real, parameter, public :: AMC_WET_ABOVE = 0.70

   public :: cn_dry
   public :: cn_wet
   public :: cn_adjust
   public :: retention_s
   public :: scs_runoff
   public :: partition_surface

contains

   ! -------------------------------------------------------------------
   ! Curve number for dry antecedent conditions (AMC I) from the average
   ! condition value CN2.  Standard conversion.
   ! -------------------------------------------------------------------
   real function cn_dry(cn2)
      real, intent(in) :: cn2
      cn_dry = cn2 / (2.334 - 0.01334 * cn2)
      if (cn_dry .lt. 30.0) cn_dry = 30.0
      if (cn_dry .gt. 100.0) cn_dry = 100.0
   end function cn_dry

   ! -------------------------------------------------------------------
   ! Curve number for wet antecedent conditions (AMC III) from CN2.
   ! -------------------------------------------------------------------
   real function cn_wet(cn2)
      real, intent(in) :: cn2
      cn_wet = cn2 / (0.4036 + 0.0059 * cn2)
      if (cn_wet .lt. 30.0) cn_wet = 30.0
      if (cn_wet .gt. 100.0) cn_wet = 100.0
   end function cn_wet

   ! -------------------------------------------------------------------
   ! Adjust the average-condition curve number for the current profile
   ! wetness.  Below AMC_DRY_BELOW we interpolate toward the dry curve,
   ! above AMC_WET_ABOVE toward the wet curve, and in between we hold the
   ! average value.  Continuous so a run does not jump as the profile
   ! crosses a threshold.
   ! -------------------------------------------------------------------
   real function cn_adjust(cn2, wetness)
      real, intent(in) :: cn2, wetness
      real :: w, cnd, cnw, f
      w = wetness
      if (w .lt. 0.0) w = 0.0
      if (w .gt. 1.0) w = 1.0
      cnd = cn_dry(cn2)
      cnw = cn_wet(cn2)
      if (w .le. AMC_DRY_BELOW) then
         ! from fully dry (w=0 -> cnd) up to CN2 at the dry threshold
         f = w / AMC_DRY_BELOW
         cn_adjust = cnd + f * (cn2 - cnd)
      else if (w .ge. AMC_WET_ABOVE) then
         ! from CN2 at the wet threshold up to the wet curve at w=1
         f = (w - AMC_WET_ABOVE) / (1.0 - AMC_WET_ABOVE)
         cn_adjust = cn2 + f * (cnw - cn2)
      else
         cn_adjust = cn2
      end if
      if (cn_adjust .lt. 30.0)  cn_adjust = 30.0
      if (cn_adjust .gt. 99.5) cn_adjust = 99.5
   end function cn_adjust

   ! -------------------------------------------------------------------
   ! Potential maximum retention S, mm, from a curve number.  The
   ! curve-number equation is written for inches; the 25400/254 form
   ! folds the inch-to-mm conversion in directly.
   ! -------------------------------------------------------------------
   real function retention_s(cn)
      real, intent(in) :: cn
      real :: c
      c = cn
      if (c .lt. 1.0)   c = 1.0
      if (c .gt. 100.0) c = 100.0
      retention_s = 25400.0 / c - 254.0
      if (retention_s .lt. 0.0) retention_s = 0.0
   end function retention_s

   ! -------------------------------------------------------------------
   ! Runoff depth Q, mm, from surface water depth P and retention S.
   ! The SCS relation with initial abstraction Ia = IA_RATIO * S.  No
   ! runoff until P exceeds Ia.
   ! -------------------------------------------------------------------
   real function scs_runoff(p, s)
      real, intent(in) :: p, s
      real :: ia, pe
      if (p .le. 0.0) then
         scs_runoff = 0.0
         return
      end if
      ia = IA_RATIO * s
      if (p .le. ia) then
         scs_runoff = 0.0
      else
         pe = p - ia
         scs_runoff = (pe * pe) / (pe + s)
      end if
      if (scs_runoff .lt. 0.0) scs_runoff = 0.0
      if (scs_runoff .gt. p)   scs_runoff = p
   end function scs_runoff

   ! -------------------------------------------------------------------
   ! The one call WATBAL makes: given the day's surface water (rain plus
   ! any snowmelt already computed), the reference curve number and the
   ! profile wetness, return how much runs off and how much infiltrates.
   ! Their sum is exactly the surface water in, so the balance closes.
   ! -------------------------------------------------------------------
   subroutine partition_surface(surface, cn2, wetness, roff, infil)
      real, intent(in)  :: surface, cn2, wetness
      real, intent(out) :: roff, infil
      real :: p, cn, s
      p = surface
      if (p .lt. 0.0) p = 0.0
      cn = cn_adjust(cn2, wetness)
      s  = retention_s(cn)
      roff  = scs_runoff(p, s)
      infil = p - roff
      if (infil .lt. 0.0) infil = 0.0
   end subroutine partition_surface

end module runoff
