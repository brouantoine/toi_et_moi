/* Runs after the test framework is installed. */
import { configure } from '@testing-library/react-native';

// Under a full parallel run, heavy screens can take over 1 s to settle: wait up to 3 s.
configure({ asyncUtilTimeout: 3000 });
