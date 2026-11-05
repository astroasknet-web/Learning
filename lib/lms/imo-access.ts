import { imoFeeRupees, imoSlug } from "@/lib/pay/course-fees";
import { classNumber } from "./school";
import { productAccess, type ProductAccess } from "./product-access";

/**
 * Maths Olympiad (IMO) is sold one class at a time (sku `course-imo-class-N`). Nothing in it is free: lessons, chapter tests and mock tests open only for
 * someone who bought that class. There is no plan pick and no free preview, and a class stays locked when the shop is unreachable (never open by default).
 */
export type ImoAccess = ProductAccess;

export async function imoAccess(cls: string): Promise<ImoAccess> {
  const n = classNumber(cls);
  return productAccess(imoSlug(n), imoFeeRupees(n));
}
