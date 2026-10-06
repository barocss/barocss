/** Ordinary ring radii in scene units and their generated Float32 scalars. */
export function validateTorusRadii(majorRadius:number,minorRadius:number):void{
 if(!Number.isFinite(majorRadius)||!Number.isFinite(minorRadius)||minorRadius<=0||minorRadius>=majorRadius||majorRadius+minorRadius>1000)throw new Error('Torus requires 0 < minor-radius < major-radius and their sum at most 1000');
 const major=Math.fround(majorRadius),minor=Math.fround(minorRadius);
 if(!Number.isFinite(major)||!Number.isFinite(minor)||minor<=0||minor>=major||Math.fround(major+minor)>1000||major+minor>1000)throw new Error('Torus radii must retain a positive ring hole and extent at most 1000 in Float32');
}
