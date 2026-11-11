import { Router } from 'express';
import { ContactController } from './contact.controller';
import { asyncHandler } from '../../middlewares/errorHandler';

const router = Router();

router.post('/', asyncHandler(ContactController.send));

export default router;
