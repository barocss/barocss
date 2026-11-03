# Decimal retained-size premise

Local installed CPython C source was not found. The official
[CPython v3.13.5 source](https://raw.githubusercontent.com/python/cpython/v3.13.5/Modules/_decimal/_decimal.c)
defines PyDecObject with inline coefficient storage at lines168–173.
At lines4612–4620, dec_sizeof starts with the object allocation size and adds
the allocated coefficient limb capacity when coefficient data is dynamic.
Its method table binds this function to Decimal.__sizeof__ at line4738.
Thus the exact C type's size report covers its retained coefficient allocation,
including unused allocated coefficient capacity. It does not cover temporary
storage used by later Decimal operations. sys.getsizeof additionally applies
the runtime's object-accounting overhead. No as_tuple conversion is needed
to discover the retained coefficient payload.

The local Homebrew Makefile records CPython3.13.5 with system mpdecimal4.0.1.
Its installed header selects64-bit limbs and19 digits per limb. PINS authenticates
that Makefile, installation receipt, exact _decimal extension, Python framework
binary, mpdecimal header/library and executable. This is the declared source/
runtime binding; source inspection alone is not a measured binary-layout test.

The helper defaults to DECIMAL_SIZE_UNKNOWN. Root may select the explicit
cpython3135-c-coefficient-v1 policy only after reviewing these pins. Runtime
checks require the exact _decimal.Decimal C class, the native __sizeof__ method,
the fixed CPython version and the original known container layouts. The fixed
Root tests check retained sizes against an independent construction registry,
including short/long coefficient cohorts and signed zero. If the binding,
method, size behavior or pins disagree, stop; never use zero or an approximate
coefficient charge as fallback.

Retained graph bytes, native operation temporaries, all-live frame roots and
process RSS remain distinct. Only the first is in this component's scope.
