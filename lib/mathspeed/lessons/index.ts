import type { Lesson } from "../curriculum";
import { LESSONS_A } from "./a";
import { LESSONS_B } from "./b";
import { LESSONS_C } from "./c";
import { LESSONS_D } from "./d";
import { LESSONS_E } from "./e";
import { LESSONS_F } from "./f";
import { LESSONS_G } from "./g";
import { LESSONS_H } from "./h";
import { LESSONS_I } from "./i";
import { LESSONS_J } from "./j";
import { LESSONS_K } from "./k";
import { LESSONS_L } from "./l";
import { LESSONS_M } from "./m";
import { LESSONS_N } from "./n";
import { LESSONS_O } from "./o";

/** Every written lesson, by module key (A-01 ...). A level is playable only when all of its modules appear here. */
export const LESSONS: Record<string, Lesson> = { ...LESSONS_A, ...LESSONS_B, ...LESSONS_C, ...LESSONS_D, ...LESSONS_E, ...LESSONS_F, ...LESSONS_G, ...LESSONS_H, ...LESSONS_I, ...LESSONS_J, ...LESSONS_K, ...LESSONS_L, ...LESSONS_M, ...LESSONS_N, ...LESSONS_O };
