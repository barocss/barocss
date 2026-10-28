<script setup>
// The mesh/native Boolean (facet-boolean.ts `facetBoolean`) on a plate mesh with a through hole, seen from above. The
// triangles are the kernel's own: a 40 × 20 × 4 mm plate of 176 triangles (its top an 8 × 4 grid, inner corners moved)
// minus a cylinder r 3.5 at (20, 10), run through facetBoolean's stages with the built kernel's own modules (splitSoup,
// brepFromTriangles, booleanAnalytic, tessellateBrep, its mendTJunctions copied) at 4 segments a quarter, and the top
// face (z = 4) of each stage kept, coordinates rounded to 0.001 mm. The final top face matches facetBoolean's own (150
// triangles), by a one-off script when the page was written.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
// Top-face triangles, x0 y0 x1 y1 x2 y2 each (mm): the mesh; each cut's far piece; what is inside after each cut;
// the near result tessellated; the far pieces after the mend; the 4 triangles split and the 8 they became; the rim; T-junctions.
const ORIG = [0,0,5,0,0,5,5,0,4.168,5.627,0,5,0,5,4.168,5.627,5.018,10.79,0,5,5.018,10.79,0,10,0,10,5.018,10.79,0,15,5.018,10.79,5.808,14.796,0,15,0,15,5.808,14.796,5,20,0,15,5,20,0,20,5,0,10,0,9.394,4.126,5,0,9.394,4.126,4.168,5.627,4.168,5.627,9.394,4.126,5.018,10.79,9.394,4.126,11.088,9.974,5.018,10.79,5.018,10.79,11.088,9.974,9.156,15.86,5.018,10.79,9.156,15.86,5.808,14.796,5.808,14.796,9.156,15.86,5,20,9.156,15.86,10,20,5,20,10,0,15,0,9.394,4.126,15,0,15.989,5.255,9.394,4.126,9.394,4.126,15.989,5.255,14.701,9.237,9.394,4.126,14.701,9.237,11.088,9.974,11.088,9.974,14.701,9.237,9.156,15.86,14.701,9.237,14.41,14.336,9.156,15.86,9.156,15.86,14.41,14.336,15,20,9.156,15.86,15,20,10,20,15,0,20,0,20.351,5.616,15,0,20.351,5.616,15.989,5.255,15.989,5.255,20.351,5.616,14.701,9.237,20.351,5.616,18.989,10.797,14.701,9.237,14.701,9.237,18.989,10.797,20.997,14.81,14.701,9.237,20.997,14.81,14.41,14.336,14.41,14.336,20.997,14.81,15,20,20.997,14.81,20,20,15,20,20,0,25,0,20.351,5.616,25,0,23.921,4.123,20.351,5.616,20.351,5.616,23.921,4.123,25.56,9.959,20.351,5.616,25.56,9.959,18.989,10.797,18.989,10.797,25.56,9.959,20.997,14.81,25.56,9.959,25.333,15.855,20.997,14.81,20.997,14.81,25.333,15.855,25,20,20.997,14.81,25,20,20,20,25,0,30,0,29.927,5.27,25,0,29.927,5.27,23.921,4.123,23.921,4.123,29.927,5.27,25.56,9.959,29.927,5.27,30.867,9.245,25.56,9.959,25.56,9.959,30.867,9.245,28.918,14.326,25.56,9.959,28.918,14.326,25.333,15.855,25.333,15.855,28.918,14.326,25,20,28.918,14.326,30,20,25,20,30,0,35,0,29.927,5.27,35,0,36.098,5.605,29.927,5.27,29.927,5.27,36.098,5.605,34.217,10.804,29.927,5.27,34.217,10.804,30.867,9.245,30.867,9.245,34.217,10.804,28.918,14.326,34.217,10.804,34.946,14.825,28.918,14.326,28.918,14.326,34.946,14.825,35,20,28.918,14.326,35,20,30,20,35,0,40,0,40,5,35,0,40,5,36.098,5.605,36.098,5.605,40,5,34.217,10.804,40,5,40,10,34.217,10.804,34.217,10.804,40,10,40,15,34.217,10.804,40,15,34.946,14.825,34.946,14.825,40,15,35,20,40,15,40,20,35,20];
const FAR = [[0,0,5,0,0,5,5,0,4.168,5.627,0,5,0,5,4.168,5.627,5.018,10.79,0,5,5.018,10.79,0,10,0,10,5.018,10.79,0,15,5.018,10.79,5.808,14.796,0,15,0,15,5.808,14.796,5,20,0,15,5,20,0,20,5,0,10,0,9.394,4.126,5,0,9.394,4.126,4.168,5.627,4.168,5.627,9.394,4.126,5.018,10.79,9.394,4.126,11.088,9.974,5.018,10.79,5.018,10.79,11.088,9.974,9.156,15.86,5.018,10.79,9.156,15.86,5.808,14.796,5.808,14.796,9.156,15.86,5,20,9.156,15.86,10,20,5,20,10,0,15,0,9.394,4.126,15,0,15.799,4.245,15.799,5.222,15,0,15.799,5.222,9.394,4.126,9.394,4.126,15.799,5.222,15.799,5.842,9.394,4.126,15.799,5.842,14.701,9.237,9.394,4.126,14.701,9.237,11.088,9.974,11.088,9.974,14.701,9.237,9.156,15.86,14.701,9.237,14.41,14.336,9.156,15.86,9.156,15.86,14.41,14.336,15,20,9.156,15.86,15,20,10,20,15,0,15.799,0,15.799,0.839,15,0,15.799,0.839,15.799,4.245,15.799,8.533,14.701,9.237,15.799,5.842,15.799,9.636,14.701,9.237,15.799,8.533,14.701,9.237,15.799,9.636,15.799,10.209,14.701,9.237,15.799,10.209,15.799,14.436,14.701,9.237,15.799,14.436,14.41,14.336,14.41,14.336,15.799,14.436,15.799,19.309,14.41,14.336,15.799,19.309,15,20,15.799,20,15,20,15.799,19.309],[24.201,0,25,0,24.201,0.965,25,0,24.201,3.053,24.201,0.965,24.201,5.12,25.56,9.959,24.201,8.826,24.201,8.826,25.56,9.959,24.201,10.132,24.201,10.132,25.56,9.959,24.201,11.404,25.56,9.959,25.333,15.855,24.201,15.582,25.56,9.959,24.201,15.582,24.201,11.404,24.201,15.582,25.333,15.855,25,20,24.201,15.582,25,20,24.201,18.964,24.201,18.964,25,20,24.201,20,25,0,30,0,29.927,5.27,25,0,29.927,5.27,24.201,4.176,25,0,24.201,4.176,24.201,3.053,24.201,4.176,29.927,5.27,25.56,9.959,24.201,4.176,25.56,9.959,24.201,5.12,29.927,5.27,30.867,9.245,25.56,9.959,25.56,9.959,30.867,9.245,28.918,14.326,25.56,9.959,28.918,14.326,25.333,15.855,25.333,15.855,28.918,14.326,25,20,28.918,14.326,30,20,25,20,30,0,35,0,29.927,5.27,35,0,36.098,5.605,29.927,5.27,29.927,5.27,36.098,5.605,34.217,10.804,29.927,5.27,34.217,10.804,30.867,9.245,30.867,9.245,34.217,10.804,28.918,14.326,34.217,10.804,34.946,14.825,28.918,14.326,28.918,14.326,34.946,14.825,35,20,28.918,14.326,35,20,30,20,35,0,40,0,40,5,35,0,40,5,36.098,5.605,36.098,5.605,40,5,34.217,10.804,40,5,40,10,34.217,10.804,34.217,10.804,40,10,40,15,34.217,10.804,40,15,34.946,14.825,34.946,14.825,40,15,35,20,40,15,40,20,35,20],[15.799,4.245,15.989,5.255,15.799,5.222,15.799,5.222,15.989,5.255,15.813,5.799,15.799,5.222,15.813,5.799,15.799,5.799,15.799,0,20,0,20.351,5.616,15.799,0,20.351,5.616,15.799,0.839,15.799,0.839,20.351,5.616,15.989,5.255,15.799,0.839,15.989,5.255,15.799,4.245,15.989,5.255,20.351,5.616,20.065,5.799,15.989,5.255,20.065,5.799,15.957,5.799,15.989,5.255,15.957,5.799,15.813,5.799,20.351,5.616,20.303,5.799,20.144,5.799,20.351,5.616,20.144,5.799,20.065,5.799,20,0,24.201,0,24.201,0.965,20,0,24.201,0.965,20.351,5.616,24.201,3.053,23.921,4.123,20.351,5.616,24.201,3.053,20.351,5.616,24.201,0.965,20.351,5.616,23.921,4.123,24.201,5.12,20.351,5.616,24.201,5.12,24.201,5.799,20.351,5.616,24.201,5.799,20.57,5.799,20.351,5.616,20.57,5.799,20.507,5.799,20.351,5.616,20.507,5.799,20.303,5.799,24.201,4.176,23.921,4.123,24.201,3.053,23.921,4.123,24.201,4.176,24.201,5.12],[20.692,14.201,20.997,14.81,20.385,14.201,20.385,14.201,20.997,14.81,20.309,14.201,20.309,14.201,20.997,14.81,15.799,14.436,20.309,14.201,15.799,14.436,15.799,14.201,15.799,14.436,20.997,14.81,15.799,19.309,20.997,14.81,20,20,15.799,20,20.997,14.81,15.799,20,15.799,19.309,21.57,14.201,20.997,14.81,20.692,14.201,24.201,15.582,20.997,14.81,21.57,14.201,24.201,15.582,21.57,14.201,24.201,14.201,20.997,14.81,24.201,15.582,24.201,18.964,20.997,14.81,24.201,18.964,24.201,20,20.997,14.81,24.201,20,20,20]];
const INSIDE = [[15.799,4.245,15.989,5.255,15.799,5.222,15.799,5.222,15.989,5.255,15.799,5.842,15.799,0,20,0,20.351,5.616,15.799,0,20.351,5.616,15.799,0.839,15.799,0.839,20.351,5.616,15.989,5.255,15.799,0.839,15.989,5.255,15.799,4.245,15.989,5.255,20.351,5.616,15.799,8.533,15.989,5.255,15.799,8.533,15.799,5.842,20.351,5.616,18.989,10.797,15.799,9.636,20.351,5.616,15.799,9.636,15.799,8.533,15.799,9.636,18.989,10.797,20.997,14.81,15.799,9.636,20.997,14.81,15.799,10.209,15.799,10.209,20.997,14.81,15.799,14.436,15.799,14.436,20.997,14.81,15.799,19.309,20.997,14.81,20,20,15.799,20,20.997,14.81,15.799,20,15.799,19.309,20,0,25,0,20.351,5.616,25,0,23.921,4.123,20.351,5.616,20.351,5.616,23.921,4.123,25.56,9.959,20.351,5.616,25.56,9.959,18.989,10.797,18.989,10.797,25.56,9.959,20.997,14.81,25.56,9.959,25.333,15.855,20.997,14.81,20.997,14.81,25.333,15.855,25,20,20.997,14.81,25,20,20,20,25,0,30,0,29.927,5.27,25,0,29.927,5.27,23.921,4.123,23.921,4.123,29.927,5.27,25.56,9.959,29.927,5.27,30.867,9.245,25.56,9.959,25.56,9.959,30.867,9.245,28.918,14.326,25.56,9.959,28.918,14.326,25.333,15.855,25.333,15.855,28.918,14.326,25,20,28.918,14.326,30,20,25,20,30,0,35,0,29.927,5.27,35,0,36.098,5.605,29.927,5.27,29.927,5.27,36.098,5.605,34.217,10.804,29.927,5.27,34.217,10.804,30.867,9.245,30.867,9.245,34.217,10.804,28.918,14.326,34.217,10.804,34.946,14.825,28.918,14.326,28.918,14.326,34.946,14.825,35,20,28.918,14.326,35,20,30,20,35,0,40,0,40,5,35,0,40,5,36.098,5.605,36.098,5.605,40,5,34.217,10.804,40,5,40,10,34.217,10.804,34.217,10.804,40,10,40,15,34.217,10.804,40,15,34.946,14.825,34.946,14.825,40,15,35,20,40,15,40,20,35,20],[15.799,4.245,15.989,5.255,15.799,5.222,15.799,5.222,15.989,5.255,15.799,5.842,15.799,0,20,0,20.351,5.616,15.799,0,20.351,5.616,15.799,0.839,15.799,0.839,20.351,5.616,15.989,5.255,15.799,0.839,15.989,5.255,15.799,4.245,15.989,5.255,20.351,5.616,15.799,8.533,15.989,5.255,15.799,8.533,15.799,5.842,20.351,5.616,18.989,10.797,15.799,9.636,20.351,5.616,15.799,9.636,15.799,8.533,15.799,9.636,18.989,10.797,20.997,14.81,15.799,9.636,20.997,14.81,15.799,10.209,15.799,10.209,20.997,14.81,15.799,14.436,15.799,14.436,20.997,14.81,15.799,19.309,20.997,14.81,20,20,15.799,20,20.997,14.81,15.799,20,15.799,19.309,20,0,24.201,0,24.201,0.965,20,0,24.201,0.965,20.351,5.616,24.201,3.053,23.921,4.123,20.351,5.616,24.201,3.053,20.351,5.616,24.201,0.965,20.351,5.616,23.921,4.123,24.201,5.12,20.351,5.616,24.201,5.12,24.201,8.826,20.351,5.616,24.201,8.826,24.201,10.132,20.351,5.616,24.201,10.132,18.989,10.797,18.989,10.797,24.201,10.132,24.201,11.404,18.989,10.797,24.201,11.404,20.997,14.81,24.201,15.582,20.997,14.81,24.201,11.404,20.997,14.81,24.201,15.582,24.201,18.964,20.997,14.81,24.201,18.964,24.201,20,20.997,14.81,24.201,20,20,20,24.201,4.176,23.921,4.123,24.201,3.053,23.921,4.123,24.201,4.176,24.201,5.12],[15.813,5.799,15.799,5.842,15.799,5.799,20.065,5.799,15.799,8.533,15.957,5.799,15.957,5.799,15.799,8.533,15.799,5.842,15.957,5.799,15.799,5.842,15.813,5.799,20.303,5.799,18.989,10.797,15.799,9.636,20.303,5.799,15.799,9.636,20.144,5.799,20.144,5.799,15.799,9.636,15.799,8.533,20.144,5.799,15.799,8.533,20.065,5.799,15.799,9.636,18.989,10.797,20.997,14.81,15.799,9.636,20.997,14.81,15.799,10.209,15.799,10.209,20.997,14.81,15.799,14.436,15.799,14.436,20.997,14.81,15.799,19.309,20.997,14.81,20,20,15.799,20,20.997,14.81,15.799,20,15.799,19.309,24.201,5.799,24.201,8.826,20.57,5.799,20.57,5.799,24.201,8.826,24.201,10.132,20.57,5.799,24.201,10.132,20.507,5.799,20.507,5.799,24.201,10.132,18.989,10.797,20.507,5.799,18.989,10.797,20.303,5.799,18.989,10.797,24.201,10.132,24.201,11.404,18.989,10.797,24.201,11.404,20.997,14.81,24.201,15.582,20.997,14.81,24.201,11.404,20.997,14.81,24.201,15.582,24.201,18.964,20.997,14.81,24.201,18.964,24.201,20,20.997,14.81,24.201,20,20,20],[15.813,5.799,15.799,5.842,15.799,5.799,20.065,5.799,15.799,8.533,15.957,5.799,15.957,5.799,15.799,8.533,15.799,5.842,15.957,5.799,15.799,5.842,15.813,5.799,20.303,5.799,18.989,10.797,15.799,9.636,20.303,5.799,15.799,9.636,20.144,5.799,20.144,5.799,15.799,9.636,15.799,8.533,20.144,5.799,15.799,8.533,20.065,5.799,15.799,9.636,18.989,10.797,20.692,14.201,15.799,9.636,20.692,14.201,20.385,14.201,15.799,9.636,20.385,14.201,20.309,14.201,15.799,9.636,20.309,14.201,15.799,10.209,15.799,10.209,20.309,14.201,15.799,14.201,24.201,5.799,24.201,8.826,20.57,5.799,20.57,5.799,24.201,8.826,24.201,10.132,20.57,5.799,24.201,10.132,20.507,5.799,20.507,5.799,24.201,10.132,18.989,10.797,20.507,5.799,18.989,10.797,20.303,5.799,18.989,10.797,24.201,10.132,24.201,11.404,18.989,10.797,24.201,11.404,21.57,14.201,18.989,10.797,21.57,14.201,20.692,14.201,21.57,14.201,24.201,11.404,24.201,14.201]];
const NEAR_TESS = [15.799,5.842,15.799,5.799,15.813,5.799,15.799,8.533,15.799,5.842,15.813,5.799,15.799,8.533,15.813,5.799,15.957,5.799,15.799,8.533,15.957,5.799,20.065,5.799,15.799,8.533,20.065,5.799,20.144,5.799,20.57,5.799,24.201,5.799,24.201,8.826,20.507,5.799,20.57,5.799,24.201,8.826,20.303,5.799,20.507,5.799,24.201,8.826,24.201,11.404,24.201,14.201,21.57,14.201,24.201,10.132,24.201,11.404,21.57,14.201,20.385,14.201,20.309,14.201,20,13.5,20.692,14.201,20.385,14.201,20,13.5,21.57,14.201,20.692,14.201,20,13.5,21.57,14.201,20,13.5,21.339,13.234,21.57,14.201,21.339,13.234,22.475,12.475,24.201,10.132,21.57,14.201,22.475,12.475,24.201,10.132,22.475,12.475,23.234,11.339,24.201,8.826,24.201,10.132,23.234,11.339,24.201,8.826,23.234,11.339,23.5,10,24.201,8.826,23.5,10,23.234,8.661,24.201,8.826,23.234,8.661,22.475,7.525,20.303,5.799,24.201,8.826,22.475,7.525,20.144,5.799,20.303,5.799,22.475,7.525,20.144,5.799,22.475,7.525,21.339,6.766,20.144,5.799,21.339,6.766,20,6.5,20.144,5.799,20,6.5,18.661,6.766,15.799,8.533,20.144,5.799,18.661,6.766,15.799,8.533,18.661,6.766,17.525,7.525,15.799,8.533,17.525,7.525,16.766,8.661,15.799,8.533,16.766,8.661,16.5,10,15.799,8.533,16.5,10,16.766,11.339,18.661,13.234,20,13.5,20.309,14.201,18.661,13.234,20.309,14.201,15.799,14.201,17.525,12.475,18.661,13.234,15.799,14.201,16.766,11.339,17.525,12.475,15.799,14.201,16.766,11.339,15.799,14.201,15.799,10.209,16.766,11.339,15.799,10.209,15.799,9.636,16.766,11.339,15.799,9.636,15.799,8.533];
const REMOVED = [9.394,4.126,15.799,5.222,15.799,5.842,14.701,9.237,15.799,10.209,15.799,14.436,24.201,5.12,25.56,9.959,24.201,8.826,25.56,9.959,24.201,15.582,24.201,11.404];
const ADDED = [9.394,4.126,15.799,5.222,15.799,5.799,9.394,4.126,15.799,5.799,15.799,5.842,14.701,9.237,15.799,10.209,15.799,14.201,14.701,9.237,15.799,14.201,15.799,14.436,25.56,9.959,24.201,8.826,24.201,5.799,25.56,9.959,24.201,5.799,24.201,5.12,25.56,9.959,24.201,15.582,24.201,14.201,25.56,9.959,24.201,14.201,24.201,11.404];
const FAR_MENDED = [[0,0,5,0,0,5,5,0,4.168,5.627,0,5,0,5,4.168,5.627,5.018,10.79,0,5,5.018,10.79,0,10,0,10,5.018,10.79,0,15,5.018,10.79,5.808,14.796,0,15,0,15,5.808,14.796,5,20,0,15,5,20,0,20,5,0,10,0,9.394,4.126,5,0,9.394,4.126,4.168,5.627,4.168,5.627,9.394,4.126,5.018,10.79,9.394,4.126,11.088,9.974,5.018,10.79,5.018,10.79,11.088,9.974,9.156,15.86,5.018,10.79,9.156,15.86,5.808,14.796,5.808,14.796,9.156,15.86,5,20,9.156,15.86,10,20,5,20,10,0,15,0,9.394,4.126,15,0,15.799,4.245,15.799,5.222,15,0,15.799,5.222,9.394,4.126,9.394,4.126,15.799,5.842,14.701,9.237,9.394,4.126,14.701,9.237,11.088,9.974,11.088,9.974,14.701,9.237,9.156,15.86,14.701,9.237,14.41,14.336,9.156,15.86,9.156,15.86,14.41,14.336,15,20,9.156,15.86,15,20,10,20,15,0,15.799,0,15.799,0.839,15,0,15.799,0.839,15.799,4.245,15.799,8.533,14.701,9.237,15.799,5.842,15.799,9.636,14.701,9.237,15.799,8.533,14.701,9.237,15.799,9.636,15.799,10.209,14.701,9.237,15.799,14.436,14.41,14.336,14.41,14.336,15.799,14.436,15.799,19.309,14.41,14.336,15.799,19.309,15,20,15.799,20,15,20,15.799,19.309,9.394,4.126,15.799,5.222,15.799,5.799,9.394,4.126,15.799,5.799,15.799,5.842,14.701,9.237,15.799,10.209,15.799,14.201,14.701,9.237,15.799,14.201,15.799,14.436],[24.201,0,25,0,24.201,0.965,25,0,24.201,3.053,24.201,0.965,24.201,8.826,25.56,9.959,24.201,10.132,24.201,10.132,25.56,9.959,24.201,11.404,25.56,9.959,25.333,15.855,24.201,15.582,24.201,15.582,25.333,15.855,25,20,24.201,15.582,25,20,24.201,18.964,24.201,18.964,25,20,24.201,20,25,0,30,0,29.927,5.27,25,0,29.927,5.27,24.201,4.176,25,0,24.201,4.176,24.201,3.053,24.201,4.176,29.927,5.27,25.56,9.959,24.201,4.176,25.56,9.959,24.201,5.12,29.927,5.27,30.867,9.245,25.56,9.959,25.56,9.959,30.867,9.245,28.918,14.326,25.56,9.959,28.918,14.326,25.333,15.855,25.333,15.855,28.918,14.326,25,20,28.918,14.326,30,20,25,20,30,0,35,0,29.927,5.27,35,0,36.098,5.605,29.927,5.27,29.927,5.27,36.098,5.605,34.217,10.804,29.927,5.27,34.217,10.804,30.867,9.245,30.867,9.245,34.217,10.804,28.918,14.326,34.217,10.804,34.946,14.825,28.918,14.326,28.918,14.326,34.946,14.825,35,20,28.918,14.326,35,20,30,20,35,0,40,0,40,5,35,0,40,5,36.098,5.605,36.098,5.605,40,5,34.217,10.804,40,5,40,10,34.217,10.804,34.217,10.804,40,10,40,15,34.217,10.804,40,15,34.946,14.825,34.946,14.825,40,15,35,20,40,15,40,20,35,20,25.56,9.959,24.201,8.826,24.201,5.799,25.56,9.959,24.201,5.799,24.201,5.12,25.56,9.959,24.201,15.582,24.201,14.201,25.56,9.959,24.201,14.201,24.201,11.404],[15.799,4.245,15.989,5.255,15.799,5.222,15.799,5.222,15.989,5.255,15.813,5.799,15.799,5.222,15.813,5.799,15.799,5.799,15.799,0,20,0,20.351,5.616,15.799,0,20.351,5.616,15.799,0.839,15.799,0.839,20.351,5.616,15.989,5.255,15.799,0.839,15.989,5.255,15.799,4.245,15.989,5.255,20.351,5.616,20.065,5.799,15.989,5.255,20.065,5.799,15.957,5.799,15.989,5.255,15.957,5.799,15.813,5.799,20.351,5.616,20.303,5.799,20.144,5.799,20.351,5.616,20.144,5.799,20.065,5.799,20,0,24.201,0,24.201,0.965,20,0,24.201,0.965,20.351,5.616,24.201,3.053,23.921,4.123,20.351,5.616,24.201,3.053,20.351,5.616,24.201,0.965,20.351,5.616,23.921,4.123,24.201,5.12,20.351,5.616,24.201,5.12,24.201,5.799,20.351,5.616,24.201,5.799,20.57,5.799,20.351,5.616,20.57,5.799,20.507,5.799,20.351,5.616,20.507,5.799,20.303,5.799,24.201,4.176,23.921,4.123,24.201,3.053,23.921,4.123,24.201,4.176,24.201,5.12],[20.692,14.201,20.997,14.81,20.385,14.201,20.385,14.201,20.997,14.81,20.309,14.201,20.309,14.201,20.997,14.81,15.799,14.436,20.309,14.201,15.799,14.436,15.799,14.201,15.799,14.436,20.997,14.81,15.799,19.309,20.997,14.81,20,20,15.799,20,20.997,14.81,15.799,20,15.799,19.309,21.57,14.201,20.997,14.81,20.692,14.201,24.201,15.582,20.997,14.81,21.57,14.201,24.201,15.582,21.57,14.201,24.201,14.201,20.997,14.81,24.201,15.582,24.201,18.964,20.997,14.81,24.201,18.964,24.201,20,20.997,14.81,24.201,20,20,20]];
const RIM = [16.766,8.661,17.525,7.525,18.661,6.766,20,6.5,21.339,6.766,22.475,7.525,23.234,8.661,23.5,10,23.234,11.339,22.475,12.475,21.339,13.234,20,13.5,18.661,13.234,17.525,12.475,16.766,11.339,16.5,10];
const TJ = [15.799,5.799,15.799,14.201,24.201,5.799,24.201,14.201];
const TOOL_BOX = [16.5, 6.5, 23.5, 13.5], PAD = 0.701;
const BOX = [TOOL_BOX[0] - PAD, TOOL_BOX[1] - PAD, TOOL_BOX[2] + PAD, TOOL_BOX[3] + PAD];
const X = x => 30 + 8 * x, Y = y => 184 - 8 * y;
const f1 = v => Math.round(v * 10) / 10;
function pathOf(a) {
  let s = '';
  for (let i = 0; i + 5 < a.length; i += 6) s += `M${f1(X(a[i]))} ${f1(Y(a[i + 1]))}L${f1(X(a[i + 2]))} ${f1(Y(a[i + 3]))}L${f1(X(a[i + 4]))} ${f1(Y(a[i + 5]))}Z`;
  return s;
}
const P_ORIG = pathOf(ORIG), P_FAR = FAR.map(pathOf), P_INSIDE = INSIDE.map(pathOf), P_NEAR = P_INSIDE[3];
const P_TESS = pathOf(NEAR_TESS), P_MENDED = FAR_MENDED.map(pathOf), P_REMOVED = pathOf(REMOVED), P_ADDED = pathOf(ADDED);
let rim = ''; for (let i = 0; i < RIM.length; i += 2) rim += `${i ? 'L' : 'M'}${f1(X(RIM[i]))} ${f1(Y(RIM[i + 1]))}`;
const P_RIM = rim + 'Z';
const TJS = []; for (let i = 0; i < TJ.length; i += 2) TJS.push([X(TJ[i]), Y(TJ[i + 1])]);
// Where each far piece is set aside (svg px): x below, x above, y below, y above.
const OFF = [[-14, 0], [14, 0], [0, 14], [0, -14]];
const FAR_COUNTS = FAR.map(a => a.length / 6);
// The cut lines, in the order facetBoolean cuts (x low, x high, y low, y high); z's planes lie outside the plate.
const CUTS = [
  { at: BOX[0], from: 0, axis: 0, label: 'x = 15.799' }, { at: BOX[2], from: 40, axis: 0, label: 'x = 24.201' },
  { at: BOX[1], from: 0, axis: 1, label: 'y = 5.799' }, { at: BOX[3], from: 20, axis: 1, label: 'y = 14.201' },
];
// The box's outline in svg px, and the cap edges along it.
const BX = [X(BOX[0]), Y(BOX[3]), X(BOX[2]) - X(BOX[0]), Y(BOX[1]) - Y(BOX[3])];
// The inset: 56 px a mm round (24.75, 13.9), the T-junction at the box's upper-right corner.
const INSET = { x: 262, y: 10, w: 112, h: 112, cx: 24.75, cy: 13.9, k: 56 };
const insetTransform = `translate(${INSET.x + INSET.w / 2} ${INSET.y + INSET.h / 2}) scale(${INSET.k / 8}) translate(${-X(INSET.cx)} ${-Y(INSET.cy)})`;
const insetT = [INSET.x + INSET.w / 2 + INSET.k * (24.201 - INSET.cx), INSET.y + INSET.h / 2 - INSET.k * (14.201 - INSET.cy)];
const ZOOM = INSET.w / INSET.k * 8; // the window's side on the main picture (px)

const steps = [
  { label: 'A mesh and a native tool', text: 'The target is a mesh body: facet faces, regions of a closed triangle mesh (here a plate of 176 triangles, its top drawn). The tool is a native body with exact faces, a cylinder of radius 3.5 mm. A difference should drill a hole with an exact wall, without turning the whole mesh into B-rep faces.' },
  { label: 'A padded box round the tool', text: 'The tool is tessellated coarsely (4 segments a quarter) only to find its box. The box is padded by a tenth of the tool\'s smallest extent, so the mesh outside it can never meet the tool. A plane of the box that misses the mesh is skipped: here both z planes do.', formula: 'pad = 0.1 · min(extent) + 10<sup>−3</sup> = 0.1 · 7 + 0.001 = 0.701 mm' },
  { label: 'Cut plane by plane', text: 'The mesh, as one welded triangle soup, is split by each plane of the box in turn (x low, x high, y low, y high) with the same split the mesh plane cut uses. Each crossed edge is cut once, so both triangles at it share the new point. The part outside is set aside as plain triangles: no body is built for it.', formula: 'below: n·p &lt; c · a vertex within 2 × weld of the plane is moved onto it (weld = max(10<sup>−9</sup>, 10<sup>−6</sup> × size))' },
  { label: 'Cap the near part', text: 'At each cut the part kept is closed by an exact planar cap: its open edges on the plane are chained into loops and triangulated from those very points. The near part is a closed solid again. Here it has 36 mesh triangles and 126 cap triangles; the limit counts the mesh ones.', formula: 'refused (CAPABILITY) when the mesh triangles near the tool &gt; 16,000 (a preview: 5,000)' },
  { label: 'Planar faces, then the exact Boolean', text: 'The near triangles become planar faces: the coplanar triangles of one source face are joined into one face (here the top, the bottom and four caps: 6 faces). That planar body goes through the analytic Boolean with the tool, which cuts the exact cylinder out of it.' },
  { label: 'Tessellate, drop the caps, rejoin', text: 'The near result is tessellated (32 segments a quarter by default; 4 here, so its triangles can be seen). Faces named <code>cap</code> are left out, and the triangles set aside come back. For an intersection the far triangles are left out instead: none of them is inside the tool.' },
  { label: 'Mend the T-junctions', text: 'The cuts ran one after another, so a piece set aside early lacks the corners later cuts added on its cut line. Such a corner lies on the open edge of a far triangle (within 4 × weld): a T-junction. That triangle is split there, fanned from its corner opposite the edge (from its centre when more than one edge is split).', formula: 'open edge a→b on a cut plane, no b→a · p on it: 0 &lt; s &lt; 1 and its distance ≤ 4 × weld' },
  { label: 'Give the tool its surfaces back', text: 'The soup becomes a facet body again, each triangle grouped by the face it came from, so mesh faces keep their names. A face from the tool gets its exact surface back (the cylinder). Its rim is the polyline where it meets the mesh; each rim edge records twice its chords\' sagitta as its tolerance.', formula: 'sagitta = L<sup>2</sup>κ / 8 (L a chord, κ the curvature through three corners) · r 3.5, 32 a quarter: 2.108 × 10<sup>−3</sup> mm' },
];
const s = useSteps(steps.length, [2600, 2800, 6400, 2600, 3200, 3200, 3600, 3000], root);
const e = computed(() => ease(s.t.value));
const lerp = (a, b, u) => a + (b - a) * u;
const clamp01 = u => Math.max(0, Math.min(1, u));

// Step 3's phases: one cut each quarter, the line sweeping in, then its far piece set aside.
const cut = computed(() => {
  const st = s.step.value;
  if (st < 2) return { j: -1, u: 0 };
  if (st > 2) return { j: 4, u: 1 };
  const t = s.t.value * 4, j = Math.min(3, Math.floor(t));
  return { j, u: clamp01(t - j) };
});
/** Each far piece: drawn?, its offset (0 → 1 of OFF), set aside (grey)? */
const far = computed(() => {
  const st = s.step.value, { j, u } = cut.value;
  return OFF.map((o, i) => {
    let show = false, k = 0, grey = false;
    if (st === 2) { if (i < j || (i === j && u >= 0.5)) { show = true; k = i < j ? 1 : ease(clamp01((u - 0.5) / 0.5)); grey = k > 0.05; } }
    else if (st === 3 || st === 4) { show = true; k = 1; grey = true; }
    else if (st === 5) { show = true; k = 1 - ease(clamp01((s.t.value - 0.35) / 0.65)); grey = k > 0.02; }
    else if (st > 5) show = true;
    return { show, grey, tr: `translate(${f1(o[0] * k)} ${f1(o[1] * k)})` };
  });
});
const mended = computed(() => s.step.value === 7 || (s.step.value === 6 && s.t.value > 0.55));
/** The body still being cut (steps 1–3): the whole mesh, then what is inside each cut so far. */
const body = computed(() => {
  const st = s.step.value, { j, u } = cut.value;
  if (st < 2) return P_ORIG;
  if (st === 2) { if (u < 0.5) return j === 0 ? P_ORIG : P_INSIDE[j - 1]; return P_INSIDE[j]; }
  return null;
});
const cutLines = computed(() => {
  const { j, u } = cut.value, out = [];
  for (let i = 0; i < 4; i++) {
    if (i > j) break;
    const c = CUTS[i], at = i < j ? c.at : lerp(c.from, c.at, ease(clamp01(u / 0.5)));
    // x cuts run the plate's height; y cuts only the part still inside the x cuts.
    out.push(c.axis === 0 ? { x1: X(at), y1: Y(-1), x2: X(at), y2: Y(21), label: c.label, now: i === j } : { x1: X(BOX[0]), y1: Y(at), x2: X(BOX[2]), y2: Y(at), label: c.label, now: i === j });
  }
  return out;
});
const padded = computed(() => {
  const k = s.step.value === 1 ? e.value : 1, b = [lerp(TOOL_BOX[0], BOX[0], k), lerp(TOOL_BOX[1], BOX[1], k), lerp(TOOL_BOX[2], BOX[2], k), lerp(TOOL_BOX[3], BOX[3], k)];
  return { x: X(b[0]), y: Y(b[3]), w: Math.max(0, X(b[2]) - X(b[0])), h: Math.max(0, Y(b[1]) - Y(b[3])) };
});
const farTop = computed(() => { const { j, u } = cut.value; let n = 0; for (let i = 0; i < 4; i++) if (i < j || (i === j && u >= 0.5)) n += FAR_COUNTS[i]; return n; });
const readout = computed(() => {
  switch (s.step.value) {
    case 0: return 'mesh: 176 triangles, 64 on the top · tool: cylinder r 3.5, z −5 to 10';
    case 1: return 'tool box x 16.5–23.5, y 6.5–13.5, z −5–10 · pad 0.701 mm';
    case 2: { const { j } = cut.value; return `cut ${j + 1} of 4: ${CUTS[j].label} · set aside so far: ${farTop.value} top triangles`; }
    case 3: return 'near: 36 mesh triangles (22 on the top) + 126 cap triangles';
    case 4: return 'near: 6 planar faces → 8 after the Boolean (the wall in two halves)';
    case 5: return 'near result: 38 top triangles, far: 108, caps dropped';
    case 6: return mended.value ? '4 triangles split into 8: the top is closed' : '4 T-junctions on the top (2 more on the bottom)';
    default: return 'volume 3046.06196 mm³ · exact 40·20·4 − π·3.5²·4 = 3046.06196';
  }
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="A mesh with a native tool: only the near part is cut" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A triangle mesh plate seen from above, cut to a box round a cylinder, drilled and rejoined">
        <defs><clipPath id="meshb-region-inset"><rect :x="INSET.x" :y="INSET.y" :width="INSET.w" :height="INSET.h" rx="6" /></clipPath></defs>
        <!-- far pieces, set aside and back -->
        <g v-for="(fp, i) in far" :key="'f' + i">
          <path v-if="fp.show" :d="mended ? P_MENDED[i] : P_FAR[i]" :transform="fp.tr" class="tri" :class="{ aside: fp.grey }" />
        </g>
        <!-- the body being cut -->
        <path v-if="body" :d="body" class="tri" />
        <!-- the near part, capped -->
        <g v-if="s.step.value === 3 || s.step.value === 4">
          <rect v-if="s.step.value === 4" :x="BX[0]" :y="BX[1]" :width="BX[2]" :height="BX[3]" class="face" :style="{ opacity: Math.min(1, 2 * e) }" />
          <path :d="P_NEAR" class="tri near" :style="{ opacity: s.step.value === 4 ? 1 - Math.min(1, 2 * e) : 1 }" />
          <rect :x="BX[0]" :y="BX[1]" :width="BX[2]" :height="BX[3]" pathLength="1" class="cap" :style="{ strokeDashoffset: s.step.value === 3 ? 1 - e : 0 }" />
          <g v-if="s.step.value === 3"><rect :x="BX[0] + BX[2] / 2 - 46" :y="BX[1] - 15" width="92" height="13" rx="3" class="chip" />
            <text :x="BX[0] + BX[2] / 2" :y="BX[1] - 5" text-anchor="middle" class="lab keep">cap (all four sides)</text></g>
        </g>
        <g v-if="s.step.value === 4">
          <circle :cx="X(20)" :cy="Y(10)" r="28" pathLength="1" class="wall" :style="{ strokeDashoffset: 1 - Math.min(1, 1.6 * e) }" />
          <circle :cx="X(20)" :cy="Y(10)" r="28" class="hole" :style="{ opacity: Math.max(0, (e - 0.55) / 0.45) }" />
          <text :x="X(20)" :y="Y(10) + 4" text-anchor="middle" class="lab b" :style="{ opacity: Math.max(0, (e - 0.55) / 0.45) }">exact wall</text>
        </g>
        <!-- the near result tessellated -->
        <g v-if="s.step.value >= 5">
          <rect v-if="s.step.value === 5" :x="BX[0]" :y="BX[1]" :width="BX[2]" :height="BX[3]" class="cap" :style="{ opacity: 1 - e }" />
          <path :d="P_TESS" class="tri near" :style="{ opacity: s.step.value === 5 ? Math.min(1, 2 * e) : 1 }" />
          <path v-if="s.step.value === 7" :d="P_RIM" class="rim" pathLength="1" :style="{ strokeDashoffset: 1 - e }" />
          <text v-if="s.step.value === 7" :x="X(20)" :y="Y(10) + 4" text-anchor="middle" class="lab b">cylinder</text>
        </g>
        <!-- the tool and its box -->
        <g v-if="s.step.value <= 2">
          <circle :cx="X(20)" :cy="Y(10)" r="28" class="tool" />
          <rect v-if="s.step.value >= 1" :x="X(TOOL_BOX[0])" :y="Y(TOOL_BOX[3])" :width="56" :height="56" class="toolbox" />
          <rect v-if="s.step.value >= 1" :x="padded.x" :y="padded.y" :width="padded.w" :height="padded.h" class="padbox" />
          <text v-if="s.step.value === 1" :x="padded.x + padded.w + 4" :y="padded.y + 10" class="lab b">+ pad</text>
        </g>
        <g v-for="(c, i) in cutLines" v-show="s.step.value <= 6" :key="'c' + i">
          <line :x1="c.x1" :y1="c.y1" :x2="c.x2" :y2="c.y2" class="cut" :class="{ now: c.now }" />
        </g>
        <!-- T-junctions -->
        <g v-if="s.step.value === 6">
          <circle v-for="(p, i) in TJS" :key="'t' + i" :cx="p[0]" :cy="p[1]" r="3.2" class="tj" />
          <rect :x="X(INSET.cx) - ZOOM / 2" :y="Y(INSET.cy) - ZOOM / 2" :width="ZOOM" :height="ZOOM" class="zoom" />
          <line :x1="X(INSET.cx) + ZOOM / 2" :y1="Y(INSET.cy) - ZOOM / 2" :x2="INSET.x" :y2="INSET.y + 18" class="zoom" />
          <rect :x="INSET.x" :y="INSET.y" :width="INSET.w" :height="INSET.h" rx="6" class="inset-bg" />
          <g clip-path="url(#meshb-region-inset)">
            <g :transform="insetTransform">
              <path :d="mended ? P_MENDED[1] : P_FAR[1]" class="tri" vector-effect="non-scaling-stroke" />
              <path :d="P_FAR[3]" class="tri" vector-effect="non-scaling-stroke" />
              <path :d="P_TESS" class="tri near" vector-effect="non-scaling-stroke" />
              <path v-if="!mended" :d="P_REMOVED" class="bad" vector-effect="non-scaling-stroke" />
              <path v-else :d="P_ADDED" class="fixed" vector-effect="non-scaling-stroke" />
            </g>
            <circle :cx="insetT[0]" :cy="insetT[1]" r="3.6" class="tj" />
          </g>
          <rect :x="INSET.x" :y="INSET.y" :width="INSET.w" :height="INSET.h" rx="6" class="inset-frame" />
          <rect :x="INSET.x + 4" :y="INSET.y + INSET.h - 19" width="78" height="15" rx="3" class="inset-bg" />
          <text :x="INSET.x + 8" :y="INSET.y + INSET.h - 8" class="lab small">×7 · {{ mended ? 'split, fanned' : 'T-junction' }}</text>
        </g>
        <g v-if="s.step.value >= 2 && s.step.value <= 5">
          <rect x="30" y="198" width="10" height="10" rx="2" class="tri near" /><text x="44" y="207" class="lab small">near the tool</text>
          <rect x="122" y="198" width="10" height="10" rx="2" class="tri aside" /><text x="136" y="207" class="lab small">set aside</text>
          <rect x="196" y="198" width="10" height="10" rx="2" class="swatch keep" /><text x="210" y="207" class="lab small">cap</text>
          <rect x="242" y="198" width="10" height="10" rx="2" class="swatch b" /><text x="256" y="207" class="lab small">tool, exact</text>
        </g>
        <text x="16" y="230" class="readout">{{ readout }}</text>
      </svg>
      <template #note>A view from above: only the plate's top face is drawn; the cuts, caps and the hole run through its
        whole thickness. The triangles are the kernel's, from this plate run through facetBoolean's stages at 4 segments a
        quarter (the default is 32). At 32 the volume and the T-junctions are the same and the rim's tolerance is 2.108 × 10⁻³ mm.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.tri { fill: color-mix(in srgb, var(--a) 10%, var(--vp-c-bg)); stroke: var(--vp-c-text-3); stroke-width: 0.6; stroke-linejoin: round; transition: fill .3s; }
.tri.aside { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-text-3); stroke-opacity: 0.45; }
.tri.near { fill: color-mix(in srgb, var(--a) 24%, var(--vp-c-bg)); stroke: var(--a); }
.face { fill: color-mix(in srgb, var(--a) 24%, var(--vp-c-bg)); stroke: var(--a); stroke-width: 1.2; }
.cap { fill: none; stroke: var(--keep); stroke-width: 3; stroke-dasharray: 1; }
.tool { fill: color-mix(in srgb, var(--b) 14%, transparent); stroke: var(--b); stroke-width: 1.6; stroke-dasharray: 4 3; }
.toolbox { fill: none; stroke: var(--b); stroke-width: 0.8; }
.padbox { fill: none; stroke: var(--b); stroke-width: 1.4; stroke-dasharray: 5 3; }
.cut { stroke: var(--hot); stroke-width: 1; stroke-dasharray: 4 3; opacity: .7; }
.cut.now { stroke-width: 1.8; opacity: 1; }
.wall { fill: none; stroke: var(--b); stroke-width: 2.4; stroke-dasharray: 1; }
.hole { fill: var(--vp-c-bg-soft); stroke: var(--b); stroke-width: 2.4; }
.rim { fill: none; stroke: var(--b); stroke-width: 2.6; stroke-dasharray: 1; stroke-linejoin: round; }
.tj { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; }
.zoom { fill: none; stroke: var(--hot); stroke-width: 1; }
.inset-bg { fill: var(--vp-c-bg); }
.chip { fill: var(--vp-c-bg-soft); }
.inset-frame { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; }
.bad { fill: color-mix(in srgb, var(--hot) 22%, transparent); stroke: var(--hot); stroke-width: 1.6; }
.fixed { fill: color-mix(in srgb, var(--keep) 18%, transparent); stroke: var(--keep); stroke-width: 1.4; }
.lab { font-size: 10px; font-weight: 600; }
.lab.keep { fill: var(--keep); } .lab.b { fill: var(--b); }
.lab.small { font-size: 10px; font-weight: 600; fill: var(--vp-c-text-2); }
.swatch { stroke-width: 1.4; } .swatch.keep { fill: color-mix(in srgb, var(--keep) 25%, var(--vp-c-bg)); stroke: var(--keep); } .swatch.b { fill: color-mix(in srgb, var(--b) 18%, var(--vp-c-bg)); stroke: var(--b); }
.readout { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
</style>
