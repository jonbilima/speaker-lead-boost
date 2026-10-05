/* When a speaker can build a speaker package.
 *
 * In practice a speaker sends the package (pricing, contract, terms) while
 * negotiating, and the client accepts by signing. So the package unlocks at
 * Applied, not at Accepted. One definition, shared by every entry point that
 * offers a package, so they can never disagree about it.
 */

/** Stages where a package can be built and sent. */
export const PACKAGE_UNLOCKED_STAGES = ["pitched", "negotiating", "accepted"] as const;

/** Engaged but too early. Listed greyed out so the speaker can see it exists. */
export const PACKAGE_LOCKED_STAGES = ["interested"] as const;

/** What the speaker sees as the unlocking stage ("pitched" is labelled Applied). */
export const PACKAGE_UNLOCK_STAGE_LABEL = "Applied";

export function canBuildPackage(stage: string | null | undefined): boolean {
  return !!stage && (PACKAGE_UNLOCKED_STAGES as readonly string[]).includes(stage);
}
