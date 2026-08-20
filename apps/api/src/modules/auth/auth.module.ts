import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { loadEnv } from '../../config/env.js';
import { CartModule } from '../cart/cart.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './domain/password.service.js';

@Module({
      imports: [
            CartModule,
            JwtModule.register({
                  global: true,
                  secret: loadEnv().JWT_SECRET,
            }),
      ],
      controllers: [AuthController],
      providers: [AuthService, PasswordService],
      exports: [AuthService],
})
export class AuthModule {}
