/*
 * PROJECT: VOID-CIRCUIT
 *
 * main.js
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
import { SystemController } from './controller.js';

window.addEventListener('DOMContentLoaded', () => {
    const sys = new SystemController();
    
    sys.init()
        .then(() => {
            sys.startLoop();
        })
        .catch((err) => {
            console.error('[Main] System initialization failed:', err);
        });

    // ページ離脱・リロード時に SystemController と配下のオブジェクトを破棄
    window.addEventListener('beforeunload', () => {
        sys.destroy();
    });
});