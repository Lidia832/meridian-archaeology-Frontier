C=======================================================================
C  WATBAL - daily soil water balance.
C  R. Halvorsen 1994.  Priestley-Taylor reference ET with a simple
C  single layer bucket.  Deliberately kept simple: the trial data does
C  not support anything more elaborate.
C
C  NOTE 1996-05: SW is carried in MILLIMETRES throughout this routine.
C  Earlier drafts used centimetres and some of the constants below
C  still read as if they were cm.  They are not.  Leave them alone.
C
C  2011-2012 (K. Osei): the single bucket was kept as the reported
C  state but the mechanics underneath it were opened up.  Precipitation
C  now passes through the SNOW module (cold-day precip is held as a
C  snowpack and released as melt), the liquid surface water is split
C  into runoff and infiltration by the RUNOFF module (SCS curve
C  number), and the profile itself is a five-layer cascade in the
C  SOILWAT module rather than one bucket.  The OUTPUT is unchanged in
C  form: SW is still the total profile water in mm, ET the actual
C  evapotranspiration, DRAIN the deep drainage below the root zone.
C
C  The water-stress fraction below is STILL SWCUR/SWMAX, formed on the
C  whole-profile totals exactly as in 1994.  GROWTH forms its own
C  stress fraction a different way; the two disagree and that is
C  MRD-204, left as-is on purpose.
C=======================================================================
      SUBROUTINE WATBAL (N, IDOY, TMAX, TMIN, RAIN, SRAD, XLAT,
     &                   AWC, RDEPTH, SW, ET, DRAIN)
      USE PET,     ONLY: PRIESTLEY_TAYLOR
      USE SOILWAT, ONLY: NLAYERS, SW_INIT, SW_TOTAL, SW_INFILTRATE,
     &                   SW_UPTAKE, SW_EVAPORATE, SW_WETNESS
      USE RUNOFF,  ONLY: CN2_DEFAULT, PARTITION_SURFACE
      USE SNOW,    ONLY: RAIN_PART, SNOW_PART, POTENTIAL_MELT
      IMPLICIT NONE

      INTEGER N
      INTEGER IDOY(N)
      REAL    TMAX(N), TMIN(N), RAIN(N), SRAD(N)
      REAL    XLAT, AWC, RDEPTH
      REAL    SW(N), ET(N), DRAIN(N)

      INTEGER I
      REAL    SWMAX, SWCUR, TAVG, ETREF, ETACT
      REAL    FRAC
      REAL    ALB

C-----Layered profile state (SOILWAT module).  CAP is field capacity
C     per layer, WAT the current water per layer; both in mm.
      REAL    CAP(NLAYERS), WAT(NLAYERS)

C-----Snow, runoff and per-day water fluxes, all mm.
      REAL    SWE, SNEW, RLIQ, PMELT, XMELT
      REAL    SURFAC, WET, ROFF, INFIL, DEEP
      REAL    ESOIL, EACT, TACT

      PARAMETER (ALB   = 0.23)

C-----Total plant available water in the profile, mm.
      SWMAX = AWC * RDEPTH
      IF (SWMAX .LE. 0.0) SWMAX = 1.0

C-----Profile starts at 60 percent of capacity.  This is a convention
C     agreed with the agronomy group in 1994 and is not calibrated.
C     SW_INIT lays that 60 percent across the five layers.
      CALL SW_INIT (AWC, RDEPTH, 0.60, CAP, WAT)

C-----Snowpack starts empty.  On decks that never see a freezing day
C     the snow path is transparent (all precip stays liquid).
      SWE = 0.0

      DO 100 I = 1, N
         TAVG = 0.5 * (TMAX(I) + TMIN(I))

C--------Precipitation phase.  The cold fraction of the day's precip is
C        added to the snowpack; the warm fraction is liquid rain.  Melt
C        is a degree-day draw on the pack, capped by what is there.
         RLIQ  = RAIN_PART(RAIN(I), TAVG)
         SNEW  = SNOW_PART(RAIN(I), TAVG)
         SWE   = SWE + SNEW
         PMELT = POTENTIAL_MELT(TAVG)
         XMELT = PMELT
         IF (XMELT .GT. SWE) XMELT = SWE
         SWE   = SWE - XMELT
         IF (SWE .LT. 0.0) SWE = 0.0

C--------Surface water reaching the ground = liquid rain + snowmelt.
         SURFAC = RLIQ + XMELT

C--------Runoff / infiltration split (SCS curve number).  The current
C        profile wetness sets the antecedent-moisture condition.
         WET = SW_WETNESS(CAP, WAT)
         CALL PARTITION_SURFACE (SURFAC, CN2_DEFAULT, WET, ROFF, INFIL)

C--------Reference ET now comes from the PET module (Priestley-Taylor).
C        The inline Tetens/PT block was moved out in 2015 so the QC
C        report could share it; see pet.f90.  The operational path is
C        unchanged: long-wave off, reference albedo.
         ETREF = PRIESTLEY_TAYLOR(TMAX(I), TMIN(I), SRAD(I))

C--------Water stress factor.  Linear below 50 percent of capacity.
C        SWCUR is the whole-profile total, SWMAX the whole-profile
C        capacity; the fraction is formed exactly as it was in 1994.
         SWCUR = SW_TOTAL(WAT)
         FRAC = SWCUR / SWMAX
         IF (FRAC .GE. 0.5) THEN
            ETACT = ETREF
         ELSE
            ETACT = ETREF * (FRAC / 0.5)
         END IF

C--------Move the water.  Infiltration enters the top layer and
C        cascades down (deep drainage falls out of the bottom layer);
C        a small soil-evaporation demand is taken from the top layer,
C        and the transpiration demand ETACT is drawn from the profile
C        weighted by rooting density.  Reported ET is what the profile
C        actually gave up.
         CALL SW_INFILTRATE (CAP, WAT, INFIL, DEEP)

         ESOIL = 0.25 * ETREF
         IF (ESOIL .LT. 0.0) ESOIL = 0.0
         CALL SW_EVAPORATE (CAP, WAT, ESOIL, EACT)
         CALL SW_UPTAKE (CAP, WAT, ETACT, TACT)

         SW(I)    = SW_TOTAL(WAT)
         ET(I)    = EACT + TACT
         DRAIN(I) = DEEP
  100 CONTINUE

      RETURN
      END
