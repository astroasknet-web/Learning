import rubricJson from "./data/rubric.json";
import dictionariesJson from "./data/dictionaries.json";
import recommendationsJson from "./data/recommendations.json";
import modelJson from "./data/model.json";

/**
 * The trainable knowledge base (rubric, dictionaries, recommendations, learned model). Editing the JSON in ./data
 * changes engine behaviour with no code change, exactly as in the PHP engine (same files, copied unchanged).
 */
export type Dictionaries = typeof dictionariesJson;
export type Rubric = typeof rubricJson;
export type Recommendations = typeof recommendationsJson;
export type ModelDef = typeof modelJson;

export const rubric = (): Rubric => rubricJson;
export const dictionaries = (): Dictionaries => dictionariesJson;
export const recommendations = (): Recommendations => recommendationsJson;
export const model = (): ModelDef => modelJson;
