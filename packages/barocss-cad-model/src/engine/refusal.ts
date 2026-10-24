// R7.3a (api-conventions.md §6): cad-model's refusals in one shape — @barocss/cad/api's BarocssError, thrown by operations,
// its message the person-readable "[CODE] …" text the agent and the docs' refusal table read; and validators' Problems,
// returned, never thrown. The codes are one union (CadModelCode), so the table can be made from the type.
import { BarocssError } from '@barocss/cad/api';
import type { FrameGeometryCode } from './doc';
import type { VersionCode } from '../versions/codes';

export { BarocssError };

/** Every code cad-model refuses with, as it is written in the message's brackets. */
export type CadModelCode =
  // robot
  | 'NO_LINK' | 'NO_JOINTS' | 'NO_FRAME' | 'NOT_PLANAR' | 'NOT_ONE_LOOP' | 'NO_CLOSURE' | 'BRANCH_FLIP' | 'NO_PIN' | 'NO_RANGE' | 'BAD_VALUES'
  // print
  | 'NOT_NEEDED' | 'ONE_BODY' | 'NO_PRINTER' | 'DIRECTION_NOT_AXIS' | 'TOO_BIG_TWO_WAYS' | 'NO_ROOM' | 'BAD_CONNECTOR'
  | 'NOT_HOLLOW' | 'GRID_TOO_FINE' | 'NO_LATTICE' | 'UNDRAINED'
  | 'CURVED_BODY' | 'NOTHING_TO_HOLLOW' | 'DRAIN_NO_ROOM' | 'BOOLEAN_REFUSED'
  // team
  | 'NO_CHANGE' | 'STALE_ECR' | 'NO_ECR' | 'DECIDED' | 'APPROVAL_IS_THE_USERS'
  | 'BAD_TRANSITION' | 'BASELINE_FROZEN' | 'STALE_BASELINE' | 'STALE_RESULT' | 'RESULT_NOT_OK' | 'NO_BASELINE' | 'BOM_INVALID'
  // chat
  | 'NO_DRAFT' | 'BAD_VALUE' | 'BOUND' | 'GONE'
  | 'REFERENCE_LOCKED' | 'BAD_REFERENCE' | 'NO_REFERENCE' | 'DATUM_FIT' | 'BAD_KEEPOUT' | 'NOT_READ'
  | 'SYNTAX' | 'UNKNOWN_NAME' | 'TYPE' | 'LIMIT' | 'REFUSED'
  // sketch
  | 'DXF_MALFORMED' | 'DXF_UNSUPPORTED' | 'DXF_OPEN' | 'DXF_NESTED' | 'DXF_EMPTY' | 'DWG_NOT_READ'
  // drawing
  | 'DRAWING_SCOPE' | 'DRAWING_SCOPE_REFERENCES' | 'DRAWING_OPTIONS' | 'DRAWING_SECTION_REFERENCES' | 'DRAWING_DETAIL_REFERENCES' | 'DRAWING_DETAIL_LETTER' | 'DRAWING_DETAIL_PARENT'
  // frames (weldments) following a sketch, a skeleton or a part
  | FrameGeometryCode | 'FRAME_SKELETON_IN_USE' | 'FRAME_PART_IN_USE'
  // 3D sketches (skeletons) and their bound values
  | 'SKETCH3D_PARAMETER' | 'SKETCH3D_INPUT' | 'SKETCH3D_CONFLICT'
  // robot frames
  | 'FRAME_NAME' | 'FRAME_LINK_MISSING' | 'FRAME_LINK_STALE' | 'FRAME_POSE'
  // assembly inputs and variants
  | 'INPUT_RANGE' | 'INPUT_TYPE' | 'INPUT_TARGET' | 'INPUT_CHOICE' | 'INPUT_NAME' | 'INPUT_CONFLICT' | 'INPUT_DEFAULT' | 'VARIANT_UNKNOWN'
  // print preview
  | 'PRINT_PREVIEW_INPUT'
  // bearings and their housings
  | 'BEARING_HOUSING_REFERENCE' | 'BEARING_HOUSING_SCOPE' | 'BEARING_HOUSING_CYCLE' | 'BEARING_HOUSING_POSE' | 'BEARING_HOUSING_EVALUATION'
  // rows
  | 'MOUNT_RANGE' | 'MOUNT_FACE' | 'MOUNT_ROW' | 'FRAME_SECTION_UNKNOWN' | 'ORING_ROW_UNKNOWN' | 'CONNECTOR_ROW_UNKNOWN' | 'BEARING_ROW_UNKNOWN'
  | 'RING_ROW_UNKNOWN' | 'DRIVE_ROW_UNKNOWN' | 'DRIVE_WHEELS' | 'FIT_FACE' | 'SHOP_ROWS_FLATTEN_SCOPE' | 'NO_TABLE' | 'NO_ROW'
  // team
  | 'NO_RUN'
  // robot motion, actuators and the readers of the exports
  | 'LIMITS_BAD' | 'LIMITS_MISSING' | 'PATH_TOO_SHORT' | 'JOINT_UNKNOWN' | 'JOINT_MIMIC' | 'JOINT_LIMIT' | 'MOTION_UNKNOWN' | 'LOOP_OPEN' | 'LOOP_MATE_UNSUPPORTED' | 'LOOP_PASSIVE' | 'DEAD_POINT' | 'CAM_PROFILE_UNSUPPORTED' | 'CAM_UNSUPPORTED' | 'CAM_IN_LOOP' | 'ACTUATOR_INPUT' | 'MODEL_READ' | 'XML_MALFORMED'
  // files
  | 'MESH_NOT_LOADED' | 'CONTAINER_NEWER' | 'CONTAINER_DAMAGED'
  // sketch export
  | 'SKETCH_PARAMETER'
  // exports
  | 'NO_BODY'
  // the assembly's edits (assembly/edit.ts)
  // parameters (engine/parameters.ts; the facade's codes)
  | 'PARAMETER_UNKNOWN' | 'PARAMETER_NAME' | 'PARAMETER_EXISTS' | 'PARAMETER_UNBINDABLE' | 'VALUE' | 'NO_FEATURE'
  | 'CONNECTOR_INVALID' | 'CONNECTOR_POINT' | 'CONNECTOR_UNAVAILABLE' | 'CONNECTOR_KIND'
  | 'NO_PART' | 'PART_MATED' | 'MATE_KIND' | 'MATE_SAME_PART' | 'MATE_BOTH_FIXED' | 'MATE_FACE_UNKNOWN' | 'MATE_FACES' | 'MATE_UNMET' | 'NO_MATE'
  // the studio's commands (a pick, a value)
  | 'ALIGN_PICK' | 'ALIGN_TURN' | 'HOLE_SIZE' | 'HOLE_PATTERN' | 'DRAFT_PICK' | 'DRAFT_ANGLE' | 'FILLET_CHAIN' | 'DECIMATE_KEEP'
  | 'SPLIT_PLANE' | 'FACE_DISTANCE' | 'LOFT_SECTIONS' | 'SWEEP_PATH' | 'PRIMITIVE_SIZE' | 'GEAR_PICK'
  | 'FASTENER_POSITION' | 'FASTENER_LENGTH' | 'FASTENER_GRIP' | 'FASTENER_SIZE_ROW'
  | 'FRAME_SECTION_PICK' | 'FRAME_MEMBER' | 'FRAME_VALUE' | 'FRAME_SKELETON_PICK' | 'FRAME_NOTCH' | 'GUSSET_PICK' | 'CAP_PICK'
  | 'SHEET_PICK' | 'SHEET_VALUE'
  // direct (NURBS) editing and IGES
  | 'DIRECT_SOURCE' | 'DIRECT_PICK' | 'DIRECT_DEGREE' | 'DIRECT_LOOP' | 'DIRECT_VALUE' | 'DIRECT_KNOT' | 'DIRECT_LOFT' | 'DIRECT_RANGE'
  | 'DIRECT_PLANE' | 'DIRECT_INTERSECT' | 'DIRECT_ID' | 'IGES_READ' | 'IGES_EXPORT' | 'TRIM_CURVE'
  // the person's row files, libraries, archives, the chat's merge
  // versions, compare and merge (CG6, versions/codes.ts)
  | VersionCode
  | 'ROWS_NOT_FROM_PERSON' | 'ROW_FILES' | 'ROW_UNKNOWN' | 'ROW_IN_USE' | 'RING_ROW' | 'FASTENER_ROW' | 'CASTING_RULE_ROW' | 'LIBRARY_ID' | 'LIBRARY_UNKNOWN' | 'ZIP_LIMIT' | 'MERGE_SUPERSEDED' | 'MERGE_MISSING';

/** A validator's finding: its code, the "[CODE] …" sentence, and where in the input (a field or a path), when it says. */
export interface Problem<C extends CadModelCode = CadModelCode> { code: C; message: string; where?: string }

/** A refusal to throw: its message "[CODE] message" — the text written before R7.3a, byte for byte. (The prefix is
 *  written here, so a message that quotes the same code further on — a nested refusal's words — keeps them.) */
export const refusal = (code: CadModelCode, message: string, details?: Record<string, unknown>): BarocssError => new BarocssError(code, `[${code}] ${message}`, undefined, details);

/** A refusal whose text is written already, "[CODE] …" (a shared constant's, a builder's): its text as it is. */
export const coded = (code: CadModelCode, text: string): BarocssError => new BarocssError(code, text);

/** A validator's problem, thrown: its message as it is. */
export const refused = (p: Problem): BarocssError => new BarocssError(p.code, p.message);

/** A validator's problem, its message "[CODE] message". */
export const problem = <C extends CadModelCode>(code: C, message: string, where?: string): Problem<C> => ({ code, message: `[${code}] ${message}`, ...(where !== undefined ? { where } : {}) });

/** Whether something thrown is one of cad-model's refusals (with this code, when given). */
export const isRefusal = (e: unknown, ...codes: CadModelCode[]): e is BarocssError & { code: CadModelCode } =>
  e instanceof BarocssError && (!codes.length || (codes as string[]).includes(e.code));

/** The first problem's message, or null: for a caller that refuses with the first. */
export const firstProblem = (problems: readonly Problem[]): string | null => problems[0]?.message ?? null;
