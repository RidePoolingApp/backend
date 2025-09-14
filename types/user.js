"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.signUpSchema = void 0;
var zod_1 = require("zod");
exports.signUpSchema = zod_1.default.object({
    name: zod_1.default.string(),
    phone: zod_1.default.string(),
    email: zod_1.default.email(),
    password: zod_1.default.string().min(8).optional(),
});
exports.loginSchema = zod_1.default.object({
    userId: zod_1.default.string(),
});
