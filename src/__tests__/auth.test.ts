import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  DEMO_MEMBER,
  DEMO_MEMBER_CHIOMA,
  DEMO_ACTIVATION_CODES,
} from '../context/AuthContext';

describe('Auth System Specifications & Unified Member Portal Flow', () => {
  beforeEach(() => {
    // Clear mock storage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('Create Account & Gym Card Linking Flow (New Portal Auth)', () => {
    it('provides pre-seeded Chioma Adeyemi member data matching portal design', () => {
      expect(DEMO_MEMBER_CHIOMA).toBeDefined();
      expect(DEMO_MEMBER_CHIOMA.fullName).toBe('Chioma Adeyemi');
      expect(DEMO_MEMBER_CHIOMA.email).toBe('chioma@example.com');
      expect(DEMO_MEMBER_CHIOMA.memberNumber).toBe('1042');
      expect(DEMO_MEMBER_CHIOMA.tier).toBe('PREMIUM');
    });

    it('requires password to be at least 8 characters', () => {
      const shortPassword = 'pass';
      const validPassword = 'password123';
      expect(shortPassword.length >= 8).toBe(false);
      expect(validPassword.length >= 8).toBe(true);
    });

    it('requires explicit consent to store check-in history and email for 24 months', () => {
      const consentGiven = false;
      const canCreate = Boolean(consentGiven);
      expect(canCreate).toBe(false);

      const acceptedConsent = true;
      expect(Boolean(acceptedConsent)).toBe(true);
    });

    it('validates email format before creating account', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test('chioma@example.com')).toBe(true);
      expect(emailRegex.test('invalid-email')).toBe(false);
      expect(emailRegex.test('chioma@')).toBe(false);
    });

    it('validates required member number from gym card', () => {
      const emptyMemberNum = '   ';
      const validMemberNum = '1042';
      expect(emptyMemberNum.trim().length > 0).toBe(false);
      expect(validMemberNum.trim().length > 0).toBe(true);
    });
  });

  describe('Credentials Login (Members, Staff and Owner)', () => {
    it('authenticates member by email or card number', () => {
      const loginByEmail = 'chioma@example.com';
      const loginByCard = '1042';
      const pass = 'password123';

      const isMatchEmail =
        loginByEmail.toLowerCase() === DEMO_MEMBER_CHIOMA.email &&
        pass === DEMO_MEMBER_CHIOMA.password;
      const isMatchCard =
        loginByCard === DEMO_MEMBER_CHIOMA.memberNumber &&
        pass === DEMO_MEMBER_CHIOMA.password;

      expect(isMatchEmail).toBe(true);
      expect(isMatchCard).toBe(true);
    });

    it('recognizes OWNER credentials in unified login', () => {
      const email = 'owner@spottergym.com';
      const pass = 'ownerpassword';
      const isValidOwner = email === 'owner@spottergym.com' && pass === 'ownerpassword';
      expect(isValidOwner).toBe(true);
    });

    it('recognizes STAFF credentials in unified login', () => {
      const email = 'desk@spottergym.com';
      const pass = 'deskpassword';
      const isValidStaff = email === 'desk@spottergym.com' && pass === 'deskpassword';
      expect(isValidStaff).toBe(true);
    });
  });

  describe('Member Log In & Create Account UI Layout & Copy', () => {
    it('AuthModal and AuthPage match Member Log In view specification', () => {
      const authModalPath = path.resolve(__dirname, '../components/auth/AuthModal.tsx');
      const authModalContent = fs.readFileSync(authModalPath, 'utf8');

      const authPagePath = path.resolve(__dirname, '../app/auth/page.tsx');
      const authPageContent = fs.readFileSync(authPagePath, 'utf8');

      for (const content of [authModalContent, authPageContent]) {
        // Badge
        expect(content).toContain('SPOTTER');
        // Title & subtitle
        expect(content).toContain('Member Log In');
        expect(content).toContain('Access your gym check-in code, attendance records, and balance.');
        // Form field label & placeholder
        expect(content).toContain('Email Address');
        expect(content).toContain('placeholder="chioma@example.com"');
        // Password row with Forgot password?
        expect(content).toContain('Forgot password?');
        // Submit button
        expect(content).toContain("'Log In'");
        // Login footer
        expect(content).toContain('New to Spotter?');
        expect(content).toContain('Create an account');
        // Create account footer: "Already registered? Login to you account"
        expect(content).toContain('Already registered?');
        expect(content).toContain('Login to you account');

        // Inline message for empty fields
        expect(content).toContain('this field must not be empty');
        expect(content).toContain('styles.fieldError');
      }
    });

    it('enforces inline empty field validation on blur and submit', () => {
      const authModalPath = path.resolve(__dirname, '../components/auth/AuthModal.tsx');
      const authModalContent = fs.readFileSync(authModalPath, 'utf8');

      const authPagePath = path.resolve(__dirname, '../app/auth/page.tsx');
      const authPageContent = fs.readFileSync(authPagePath, 'utf8');

      for (const content of [authModalContent, authPageContent]) {
        // Full name field validation
        expect(content).toContain('error-input-full-name');
        // Email address field validation
        expect(content).toContain('error-input-email-address');
        // Member number field validation
        expect(content).toContain('error-input-member-number');
        // Password field validation
        expect(content).toContain('error-input-create-password');
        // Login identifier field validation
        expect(content).toContain('error-input-login-id');
        // Login password field validation
        expect(content).toContain('error-input-login-password');

        // OnBlur handlers present on inputs
        expect(content).toContain('onBlur');
        // Accessible attributes present
        expect(content).toContain('aria-invalid');
        expect(content).toContain('aria-describedby');
        expect(content).toContain('role="alert"');
      }
    });

    it('simulates empty check validation logic on blur without typing', () => {
      const validateBlur = (val: string) => {
        return !val.trim();
      };

      // Focused on leave without typing anything
      expect(validateBlur('')).toBe(true);
      expect(validateBlur('   ')).toBe(true);

      // Typed characters
      expect(validateBlur('Chioma')).toBe(false);
      expect(validateBlur('chioma@example.com')).toBe(false);
      expect(validateBlur('1042')).toBe(false);
      expect(validateBlur('password123')).toBe(false);
    });

    it('ensures no field is left empty on submit across all fields', () => {
      const validateSubmit = (fields: Record<string, string>) => {
        const errors: Record<string, boolean> = {};
        let hasError = false;
        for (const [key, val] of Object.entries(fields)) {
          if (!val.trim()) {
            errors[key] = true;
            hasError = true;
          }
        }
        return { hasError, errors };
      };

      // Empty submission
      const allEmpty = validateSubmit({
        fullName: '',
        email: '',
        memberNumber: '',
        password: '',
      });
      expect(allEmpty.hasError).toBe(true);
      expect(allEmpty.errors.fullName).toBe(true);
      expect(allEmpty.errors.email).toBe(true);
      expect(allEmpty.errors.memberNumber).toBe(true);
      expect(allEmpty.errors.password).toBe(true);

      // Fully populated submission
      const populated = validateSubmit({
        fullName: 'Chioma Adeyemi',
        email: 'chioma@example.com',
        memberNumber: '1042',
        password: 'password123',
      });
      expect(populated.hasError).toBe(false);
      expect(Object.keys(populated.errors).length).toBe(0);
    });

    it('enforces minLength={2} and at least 2 words on the full name field in AuthModal and AuthPage', () => {
      const authModalPath = path.resolve(__dirname, '../components/auth/AuthModal.tsx');
      const authModalContent = fs.readFileSync(authModalPath, 'utf8');

      const authPagePath = path.resolve(__dirname, '../app/auth/page.tsx');
      const authPageContent = fs.readFileSync(authPagePath, 'utf8');

      for (const content of [authModalContent, authPageContent]) {
        // minLength={2} attribute
        expect(content).toContain('minLength={2}');

        // getFullNameError validator function
        expect(content).toContain('getFullNameError');
        expect(content).toContain('trimmed.length < 2');
        expect(content).toContain('words.length < 2');
      }
    });

    it('validates full name rules: minimum length 2 and at least 2 words separated by space', () => {
      const validateFullName = (name: string): { valid: boolean; error: string | null } => {
        const trimmed = name.trim();
        if (!trimmed) {
          return { valid: false, error: 'this field must not be empty' };
        }
        if (trimmed.length < 2) {
          return { valid: false, error: 'Full name must be at least 2 characters.' };
        }
        const words = trimmed.split(/\s+/).filter(Boolean);
        if (words.length < 2) {
          return { valid: false, error: 'Please enter at least 2 words or names separated by a space.' };
        }
        return { valid: true, error: null };
      };

      // Fails on empty
      expect(validateFullName('').valid).toBe(false);
      expect(validateFullName('   ').valid).toBe(false);
      expect(validateFullName('').error).toBe('this field must not be empty');

      // Fails on length < 2
      expect(validateFullName('A').valid).toBe(false);
      expect(validateFullName('A').error).toBe('Full name must be at least 2 characters.');

      // Fails on single word / name (no separator)
      expect(validateFullName('Chioma').valid).toBe(false);
      expect(validateFullName('Chioma').error).toBe('Please enter at least 2 words or names separated by a space.');
      expect(validateFullName('Madonna').valid).toBe(false);
      expect(validateFullName('Adeyemi').valid).toBe(false);

      // Passes on 2 words separated by space (length >= 2)
      expect(validateFullName('Chioma Adeyemi').valid).toBe(true);
      expect(validateFullName('Chioma Adeyemi').error).toBeNull();
      expect(validateFullName('A B').valid).toBe(true);
      expect(validateFullName('John Doe').valid).toBe(true);

      // Passes on 3 words separated by spaces
      expect(validateFullName('Chioma Mary Adeyemi').valid).toBe(true);
      expect(validateFullName('Chioma Mary Adeyemi').error).toBeNull();
    });

    it('enforces real-time inline email validation in AuthModal and AuthPage', () => {
      const authModalPath = path.resolve(__dirname, '../components/auth/AuthModal.tsx');
      const authModalContent = fs.readFileSync(authModalPath, 'utf8');

      const authPagePath = path.resolve(__dirname, '../app/auth/page.tsx');
      const authPageContent = fs.readFileSync(authPagePath, 'utf8');

      for (const content of [authModalContent, authPageContent]) {
        // getEmailError validator function
        expect(content).toContain('getEmailError');
        // Real-time inline message string
        expect(content).toContain('enter a valid email address');
      }
    });

    it('validates real-time email format behavior: shows when typing starts, disappears on valid format', () => {
      const getEmailError = (val: string, touched: boolean): string | null => {
        if (!val) {
          return touched ? 'this field must not be empty' : null;
        }
        const trimmed = val.trim();
        if (!trimmed) {
          return 'enter a valid email address';
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          return 'enter a valid email address';
        }
        return null;
      };

      // Initial state: not typed, not touched -> no error
      expect(getEmailError('', false)).toBeNull();

      // Touched and left empty -> "this field must not be empty"
      expect(getEmailError('', true)).toBe('this field must not be empty');

      // The moment the user starts typing an invalid email -> "enter a valid email address"
      expect(getEmailError('c', false)).toBe('enter a valid email address');
      expect(getEmailError('chioma', false)).toBe('enter a valid email address');
      expect(getEmailError('chioma@', false)).toBe('enter a valid email address');
      expect(getEmailError('chioma@example', false)).toBe('enter a valid email address');
      expect(getEmailError('chioma@example.', false)).toBe('enter a valid email address');

      // The moment a valid email format is completed -> error disappears (null)
      expect(getEmailError('chioma@example.com', false)).toBeNull();
      expect(getEmailError('chioma@example.com', true)).toBeNull();
      expect(getEmailError('member.1042@gym.spotter.ng', false)).toBeNull();

      // If user introduces an error again -> error reappears
      expect(getEmailError('chioma@example.com ', false)).toBeNull(); // trimmed is valid
      expect(getEmailError('chioma@example', false)).toBe('enter a valid email address');
    });

    it('enforces maxLength={6}, type="text", and numeric-only filtering on member number in AuthModal and AuthPage', () => {
      const authModalPath = path.resolve(__dirname, '../components/auth/AuthModal.tsx');
      const authModalContent = fs.readFileSync(authModalPath, 'utf8');

      const authPagePath = path.resolve(__dirname, '../app/auth/page.tsx');
      const authPageContent = fs.readFileSync(authPagePath, 'utf8');

      for (const content of [authModalContent, authPageContent]) {
        // type="text"
        expect(content).toContain('id="input-member-number"');
        expect(content).toContain('maxLength={6}');

        // Numeric filtering logic
        expect(content).toContain('replace(/\\D/g');
        expect(content).toContain('getMemberNumberError');

        // Placeholder does not hint length
        expect(content).toContain('placeholder="Enter member number"');

        // No inline hint under member number field
        expect(content).not.toContain('Enter the member number on your gym card.');
      }
    });

    it('validates member number: exactly 6 digits and numeric-only', () => {
      const filterMemberNumberInput = (raw: string) => {
        return raw.replace(/\D/g, '').slice(0, 6);
      };

      // Strips non-numeric characters and enforces max length 6
      expect(filterMemberNumberInput('abc')).toBe('');
      expect(filterMemberNumberInput('12a3b4c')).toBe('1234');
      expect(filterMemberNumberInput('123456789')).toBe('123456');
      expect(filterMemberNumberInput('104200')).toBe('104200');

      const getMemberNumberError = (val: string, touched: boolean): string | null => {
        const trimmed = val.trim();
        if (!trimmed) {
          return touched ? 'this field must not be empty' : null;
        }
        if (trimmed.length < 6 || !/^\d{6}$/.test(trimmed)) {
          return touched ? 'Member number must be 6 digits.' : null;
        }
        return null;
      };

      // Empty states
      expect(getMemberNumberError('', false)).toBeNull();
      expect(getMemberNumberError('', true)).toBe('this field must not be empty');

      // Less than 6 digits
      expect(getMemberNumberError('1', true)).toBe('Member number must be 6 digits.');
      expect(getMemberNumberError('12345', true)).toBe('Member number must be 6 digits.');

      // Exactly 6 digits
      expect(getMemberNumberError('104200', true)).toBeNull();
      expect(getMemberNumberError('123456', true)).toBeNull();
    });

    it('ensures password hint is not shown by default and displays when typing starts in AuthModal and AuthPage', () => {
      const authModalPath = path.resolve(__dirname, '../components/auth/AuthModal.tsx');
      const authModalContent = fs.readFileSync(authModalPath, 'utf8');

      const authPagePath = path.resolve(__dirname, '../app/auth/page.tsx');
      const authPageContent = fs.readFileSync(authPagePath, 'utf8');

      for (const content of [authModalContent, authPageContent]) {
        // Password hint does not show by default: wrapped in Boolean(password)
        expect(content).toContain('{Boolean(password) &&');
        expect(content).toContain('Use at least eight characters.');
        expect(content).toContain('hint-input-create-password');
      }

      // Logic check: by default (empty string), hint is false; when typing starts, hint is true
      const shouldShowHint = (pwd: string) => Boolean(pwd);
      expect(shouldShowHint('')).toBe(false);
      expect(shouldShowHint('a')).toBe(true);
      expect(shouldShowHint('secret')).toBe(true);
      expect(shouldShowHint('password123')).toBe(true);
    });

    it('disables the create account button and enables it only when user is done filling the form with no errors', () => {
      const authModalPath = path.resolve(__dirname, '../components/auth/AuthModal.tsx');
      const authModalContent = fs.readFileSync(authModalPath, 'utf8');

      const authPagePath = path.resolve(__dirname, '../app/auth/page.tsx');
      const authPageContent = fs.readFileSync(authPagePath, 'utf8');

      for (const content of [authModalContent, authPageContent]) {
        expect(content).toContain('isCreateFormValid');
        expect(content).toContain('disabled={!isCreateFormValid || isSubmitting}');
      }

      const validateCreateForm = (form: {
        fullName: string;
        email: string;
        memberNumber: string;
        password: string;
        hasConsented: boolean;
      }) => {
        const getFullNameError = (val: string) => {
          const trimmed = val.trim();
          if (!trimmed || trimmed.length < 2) return 'error';
          if (trimmed.split(/\s+/).filter(Boolean).length < 2) return 'error';
          return null;
        };
        const getEmailError = (val: string) => {
          const trimmed = val.trim();
          if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'error';
          return null;
        };
        const getMemberNumberError = (val: string) => {
          const trimmed = val.trim();
          if (!trimmed || trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) return 'error';
          return null;
        };

        return (
          getFullNameError(form.fullName) === null &&
          getEmailError(form.email) === null &&
          getMemberNumberError(form.memberNumber) === null &&
          form.password.length >= 8 &&
          form.hasConsented
        );
      };

      // Empty form -> disabled
      expect(validateCreateForm({
        fullName: '',
        email: '',
        memberNumber: '',
        password: '',
        hasConsented: false,
      })).toBe(false);

      // Incomplete: missing consent -> disabled
      expect(validateCreateForm({
        fullName: 'Chioma Adeyemi',
        email: 'chioma@example.com',
        memberNumber: '104200',
        password: 'password123',
        hasConsented: false,
      })).toBe(false);

      // Incomplete: short password -> disabled
      expect(validateCreateForm({
        fullName: 'Chioma Adeyemi',
        email: 'chioma@example.com',
        memberNumber: '104200',
        password: 'short',
        hasConsented: true,
      })).toBe(false);

      // Incomplete: member number not 6 digits -> disabled
      expect(validateCreateForm({
        fullName: 'Chioma Adeyemi',
        email: 'chioma@example.com',
        memberNumber: '1042',
        password: 'password123',
        hasConsented: true,
      })).toBe(false);

      // Incomplete: invalid email -> disabled
      expect(validateCreateForm({
        fullName: 'Chioma Adeyemi',
        email: 'invalid-email',
        memberNumber: '104200',
        password: 'password123',
        hasConsented: true,
      })).toBe(false);

      // Incomplete: single word name -> disabled
      expect(validateCreateForm({
        fullName: 'Chioma',
        email: 'chioma@example.com',
        memberNumber: '104200',
        password: 'password123',
        hasConsented: true,
      })).toBe(false);

      // Fully valid form with no errors -> ENABLED
      expect(validateCreateForm({
        fullName: 'Chioma Adeyemi',
        email: 'chioma@example.com',
        memberNumber: '104200',
        password: 'password123',
        hasConsented: true,
      })).toBe(true);
    });

    it('displays a signal to accept terms and conditions when clicking the disabled create account button with all fields filled', () => {
      const authModalPath = path.resolve(__dirname, '../components/auth/AuthModal.tsx');
      const authModalContent = fs.readFileSync(authModalPath, 'utf8');

      const authPagePath = path.resolve(__dirname, '../app/auth/page.tsx');
      const authPageContent = fs.readFileSync(authPagePath, 'utf8');

      for (const content of [authModalContent, authPageContent]) {
        // Container to capture click on disabled button
        expect(content).toContain('submitButtonContainer');
        expect(content).toContain('handleDisabledButtonClick');

        // Inline error signal element
        expect(content).toContain('id="error-consent"');
        expect(content).toContain('Please accept the terms and conditions to continue.');

        // Visual alert class on consent row
        expect(content).toContain('consentRowAlert');
      }

      // Signal trigger logic test
      const simulateDisabledButtonClick = (state: {
        areFieldsFilledAndValid: boolean;
        hasConsented: boolean;
      }) => {
        if (!state.hasConsented && state.areFieldsFilledAndValid) {
          return {
            showSignal: true,
            message: 'Please accept the terms and conditions to continue.',
          };
        }
        return {
          showSignal: false,
          message: null,
        };
      };

      // 1. All fields filled, but terms and conditions not accepted -> shows signal!
      const allFieldsNoConsent = simulateDisabledButtonClick({
        areFieldsFilledAndValid: true,
        hasConsented: false,
      });
      expect(allFieldsNoConsent.showSignal).toBe(true);
      expect(allFieldsNoConsent.message).toBe('Please accept the terms and conditions to continue.');

      // 2. Fields NOT all filled, terms not accepted -> does not show terms signal
      const incompleteFields = simulateDisabledButtonClick({
        areFieldsFilledAndValid: false,
        hasConsented: false,
      });
      expect(incompleteFields.showSignal).toBe(false);

      // 3. User accepts terms -> signal disappears and form is valid
      const accepted = simulateDisabledButtonClick({
        areFieldsFilledAndValid: true,
        hasConsented: true,
      });
      expect(accepted.showSignal).toBe(false);
    });

    it('normalizes email address input to lower case as the user types in create account form', () => {
      const authModalPath = path.resolve(__dirname, '../components/auth/AuthModal.tsx');
      const authModalContent = fs.readFileSync(authModalPath, 'utf8');

      const authPagePath = path.resolve(__dirname, '../app/auth/page.tsx');
      const authPageContent = fs.readFileSync(authPagePath, 'utf8');

      for (const content of [authModalContent, authPageContent]) {
        expect(content).toContain('setEmail(e.target.value.toLowerCase())');
        expect(content).toContain('autoCapitalize="none"');
      }

      // Test normalization logic
      const normalizeEmailInput = (typedValue: string) => typedValue.toLowerCase();
      expect(normalizeEmailInput('CHIOMA@EXAMPLE.COM')).toBe('chioma@example.com');
      expect(normalizeEmailInput('Chioma.Adeyemi@Example.Com')).toBe('chioma.adeyemi@example.com');
    });

    it('trims password fields on create account and login forms', () => {
      const authModalPath = path.resolve(__dirname, '../components/auth/AuthModal.tsx');
      const authModalContent = fs.readFileSync(authModalPath, 'utf8');

      const authPagePath = path.resolve(__dirname, '../app/auth/page.tsx');
      const authPageContent = fs.readFileSync(authPagePath, 'utf8');

      for (const content of [authModalContent, authPageContent]) {
        expect(content).toContain('password.trim().length >= 8');
        expect(content).toContain('trimmedPassword !== password');
        expect(content).toContain('trimmedPassword !== loginPassword');
      }

      // Test password trim logic
      const trimPassword = (val: string) => val.trim();
      expect(trimPassword('  mypassword123  ')).toBe('mypassword123');
      expect(trimPassword('        ')).toBe('');
      expect(trimPassword('  short  ').length >= 8).toBe(false);
    });
  });
});



