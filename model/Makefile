# Meridian numerical core.
# Built with gfortran since 2011; originally f77 on the HP-UX box.
# Module files (params, weather, pet, ...) must compile before the
# fixed-form routines that USE them, so the object order matters.
#
# Dependency layers (compile top to bottom):
#   params                      - constants and cultivar type
#   weather                     - derived weather (uses params)
#   pet                         - reference ET (uses params, weather)
#   soilwat, runoff, snow       - water-side modules (Aquifer)
#   phenology                   - stages (uses params, weather)
#   canopy, partition           - growth-side modules (Canopy)
#   waterbal                    - fixed-form, USEs pet+soilwat+runoff+snow
#   growth                      - free-form, USEs phenology+canopy+partition
#   cropmod                     - fixed-form driver
FC      = gfortran
FFLAGS  = -O2 -std=legacy -ffixed-line-length-72 -w
F90FLAGS= -O2 -w

OBJ = params.o weather.o pet.o soilwat.o runoff.o snow.o \
      phenology.o canopy.o partition.o waterbal.o growth.o cropmod.o

all: cropmod

cropmod: $(OBJ)
	$(FC) -o cropmod $(OBJ)

# ---- base layers --------------------------------------------------
params.o:   params.f90
	$(FC) $(F90FLAGS) -c params.f90
weather.o:  weather.f90 params.o
	$(FC) $(F90FLAGS) -c weather.f90
pet.o:      pet.f90 params.o weather.o
	$(FC) $(F90FLAGS) -c pet.f90

# ---- water side (Aquifer) -----------------------------------------
soilwat.o:  soilwat.f90
	$(FC) $(F90FLAGS) -c soilwat.f90
runoff.o:   runoff.f90
	$(FC) $(F90FLAGS) -c runoff.f90
snow.o:     snow.f90
	$(FC) $(F90FLAGS) -c snow.f90
waterbal.o: waterbal.f pet.o soilwat.o runoff.o snow.o
	$(FC) $(FFLAGS) -c waterbal.f

# ---- growth side (Canopy) -----------------------------------------
phenology.o: phenology.f90 params.o weather.o
	$(FC) $(F90FLAGS) -c phenology.f90
canopy.o:    canopy.f90 params.o phenology.o
	$(FC) $(F90FLAGS) -c canopy.f90
partition.o: partition.f90 params.o phenology.o
	$(FC) $(F90FLAGS) -c partition.f90
growth.o:    growth.f90 params.o phenology.o canopy.o partition.o
	$(FC) $(F90FLAGS) -c growth.f90

# ---- driver -------------------------------------------------------
cropmod.o:  cropmod.f
	$(FC) $(FFLAGS) -c cropmod.f

clean:
	rm -f *.o *.mod cropmod MERIDIAN.OUT
