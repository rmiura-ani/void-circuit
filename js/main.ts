/*
 * PROJECT: VOID-CIRCUIT
 *
 * main.ts
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

import './ga.js';
import { SystemController } from './controller.js';

window.addEventListener('DOMContentLoaded', () => {
    const sys = new SystemController();

    sys.init()
        .then(() => {
            sys.startLoop();
        })
        .catch((err: unknown) => {
            console.error('[Main] System initialization failed:', err);
        });
});