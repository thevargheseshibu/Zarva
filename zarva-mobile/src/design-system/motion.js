/**
 * src/design-system/motion.js
 * ZARVA Animation Language
 */

import { Easing } from 'react-native-reanimated';

export const durations = {
    micro: 150, // icon swap, badge pop
    component: 260, // card entrance, button state
    screen: 400, // transitions, sheet reveal
    celebration: 600, // success states, completion
};

export const easings = {
    standard: Easing.bezier(0.23, 1, 0.32, 1), // ease-out
    entrance: Easing.out(Easing.cubic),
    celebration: Easing.out(Easing.exp),
};

export const springs = {
    press: {
        damping: 15,
        stiffness: 300,
        mass: 0.8,
    },
    bounce: {
        damping: 12,
        stiffness: 200,
    }
};

export const timingConfig = {
    micro: { duration: durations.micro, easing: easings.standard },
    component: { duration: durations.component, easing: easings.standard },
    screen: { duration: durations.screen, easing: easings.standard },
};
