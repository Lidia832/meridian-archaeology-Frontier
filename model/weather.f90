! ======================================================================
!  WEATHER - derived weather quantities used by both sides of the model.
!
!  Pulled out of WATBAL and GROWTH in 2009 so the daylength and vapour
!  pressure code was not maintained in two places.  It was, of course,
!  maintained in two places anyway until this module was written.
!
!  M. Chen, 2009-05-20.
! ======================================================================
module weather
   use crop_params, only : PI
   implicit none
   public

contains

   ! Mean daily air temperature.
   elemental function tavg(tmax, tmin) result(t)
      real, intent(in) :: tmax, tmin
      real :: t
      t = 0.5 * (tmax + tmin)
   end function tavg

   ! Saturation vapour pressure, kPa (Tetens).
   elemental function svp(t) result(es)
      real, intent(in) :: t
      real :: es
      es = 0.6108 * exp((17.27 * t) / (t + 237.3))
   end function svp

   ! Slope of the saturation vapour pressure curve, kPa/degC.
   elemental function svp_slope(t) result(delta)
      real, intent(in) :: t
      real :: delta
      delta = (4098.0 * svp(t)) / ((t + 237.3) ** 2)
   end function svp_slope

   ! Vapour pressure deficit from daily extremes, kPa.  VPD is formed
   ! from the min-temperature saturation value as the actual vapour
   ! pressure, which assumes dewpoint near TMIN.  Good enough for this
   ! region and never revisited.
   elemental function vpd(tmax, tmin) result(d)
      real, intent(in) :: tmax, tmin
      real :: d, es_mean, ea
      es_mean = 0.5 * (svp(tmax) + svp(tmin))
      ea      = svp(tmin)
      d       = max(es_mean - ea, 0.0)
   end function vpd

   ! Astronomical daylength, hours, from latitude (deg N) and day of
   ! year.  Used by the phenology photoperiod term.
   function daylength(xlat, idoy) result(hours)
      real,    intent(in) :: xlat
      integer, intent(in) :: idoy
      real :: hours, decl, lat_r, arg
      decl  = 0.4093 * sin(2.0 * PI * (real(idoy) - 79.0) / 365.0)
      lat_r = xlat * PI / 180.0
      arg   = -tan(lat_r) * tan(decl)
      if (arg .ge. 1.0) then
         hours = 0.0
      else if (arg .le. -1.0) then
         hours = 24.0
      else
         hours = 24.0 * acos(arg) / PI
      end if
   end function daylength

   ! Extraterrestrial radiation, MJ/m2/day, for the clear-sky checks in
   ! the QC pass.  Not used by the water balance directly.
   function extra_radiation(xlat, idoy) result(ra)
      use crop_params, only : SOLARC
      real,    intent(in) :: xlat
      integer, intent(in) :: idoy
      real :: ra, dr, decl, lat_r, ws
      dr    = 1.0 + 0.033 * cos(2.0 * PI * real(idoy) / 365.0)
      decl  = 0.409 * sin(2.0 * PI * real(idoy) / 365.0 - 1.39)
      lat_r = xlat * PI / 180.0
      ws    = acos(max(-1.0, min(1.0, -tan(lat_r) * tan(decl))))
      ra    = (24.0 * 60.0 / PI) * SOLARC * dr * &
              (ws * sin(lat_r) * sin(decl) + cos(lat_r) * cos(decl) * sin(ws))
      if (ra .lt. 0.0) ra = 0.0
   end function extra_radiation

end module weather
