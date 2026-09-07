import { Router } from "express";
import registerRouter from "./register";
import loginRouter from "./login";
import passwordRouter from "./password";
import profileRouter from "./profile";

const router = Router();

router.use(registerRouter);
router.use(loginRouter);
router.use(passwordRouter);
router.use(profileRouter);

export default router;
