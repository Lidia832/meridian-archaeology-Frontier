! ======================================================================
!  PET - reference and potential evapotranspiration.
!
!  WATBAL historically had the Priestley-Taylor reference ET inline.
!  This module pulls it out and adds a Penman-Monteith option that the
!  2015 "FAO-56 alignment" work needed.  The Penman-Monteith path is
!  present and tested but NOT wired into WATBAL, because switching the
!  operational reference ET would move every forecast and no one would
!  sign off without the validation harness that does not exist (MRD-231).
!
!  So the platform computes FAO-56 ET in the QC report and Priestley-
!  Taylor ET in the model, and the two do not match.  Everybody knows.
!
!  P. Nakamura, 2015-03-30.
! ======================================================================
module pet
   use crop_params, only : ALBEDO, PSYCHRO, PT_ALPHA, LAMBDA, STEFAN
   use weather,     only : svp, svp_slope, tavg, vpd
   implicit none
   private

   public :: net_radiation
   public :: priestley_taylor
   public :: penman_monteith

contains

   ! Net radiation, MJ/m2/day, from incoming shortwave.  The long-wave
   ! term is the crude constant-emissivity form; it is disabled in the
   ! operational path (see priestley_taylor) to reproduce the 1994
   ! numbers exactly.
   function net_radiation(srad, tmax, tmin, include_longwave) result(rn)
      real,    intent(in) :: srad, tmax, tmin
      logical, intent(in) :: include_longwave
      real :: rn, rns, rnl, tmaxk4, tmink4
      rns = (1.0 - ALBEDO) * srad
      if (include_longwave) then
         tmaxk4 = (tmax + 273.16) ** 4
         tmink4 = (tmin + 273.16) ** 4
         rnl = STEFAN * 0.5 * (tmaxk4 + tmink4) * (0.34 - 0.14 * sqrt(max(svp(tmin), 0.0)))
         rn  = rns - rnl
      else
         rn = rns
      end if
      if (rn .lt. 0.0) rn = 0.0
   end function net_radiation

   ! Priestley-Taylor reference ET, mm/day.  This is the operational
   ! path and MUST reproduce the historical constants: long-wave off,
   ! net radiation straight from shortwave with the reference albedo.
   function priestley_taylor(tmax, tmin, srad) result(et0)
      real, intent(in) :: tmax, tmin, srad
      real :: et0, t, delta, rnet
      t     = tavg(tmax, tmin)
      delta = svp_slope(t)
      rnet  = net_radiation(srad, tmax, tmin, .false.)
      et0   = PT_ALPHA * (delta / (delta + PSYCHRO)) * rnet / LAMBDA
      if (et0 .lt. 0.0) et0 = 0.0
   end function priestley_taylor

   ! FAO-56 Penman-Monteith reference ET, mm/day, with a nominal wind of
   ! 2 m/s (the loggers do not report wind reliably).  Used by the QC
   ! report only.
   function penman_monteith(tmax, tmin, srad, u2) result(et0)
      real, intent(in) :: tmax, tmin, srad, u2
      real :: et0, t, delta, rnet, g, num, den, d
      t     = tavg(tmax, tmin)
      delta = svp_slope(t)
      rnet  = net_radiation(srad, tmax, tmin, .true.)
      g     = 0.0                     ! soil heat flux, daily ~ 0
      d     = vpd(tmax, tmin)
      num   = 0.408 * delta * (rnet - g) + &
              PSYCHRO * (900.0 / (t + 273.0)) * u2 * d
      den   = delta + PSYCHRO * (1.0 + 0.34 * u2)
      et0   = num / den
      if (et0 .lt. 0.0) et0 = 0.0
   end function penman_monteith

end module pet
