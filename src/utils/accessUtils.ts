import { MyContext, CACHE_EXPIRY } from "../config";
import { userExists } from "../dbOperations";

export async function checkUserAccess(ctx: MyContext): Promise<boolean> {
	const now = Date.now();
	if (
		ctx.session.accessVerified &&
		ctx.session.accessVerifiedAt &&
		now - ctx.session.accessVerifiedAt < CACHE_EXPIRY
	) {
		return ctx.session.accessVerified;
	}

	const hasAccess = await userExists(ctx.from!.id.toString());
	ctx.session.accessVerified = hasAccess;
	ctx.session.accessVerifiedAt = now;

	return hasAccess;
}
