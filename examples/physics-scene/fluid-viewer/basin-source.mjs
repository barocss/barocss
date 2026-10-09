export const basinSource = '@model fluid_basin { version:0; length-unit:mm; '
  + '@surface #floor { type:nurbs; degree-u:1; degree-v:1; '
  + 'knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; '
  + 'control-points:[[[0,0,0],[0,0,500]],[[700,0,0],[700,0,500]]]; '
  + 'weights:[[1,1],[1,1]]; } }';
