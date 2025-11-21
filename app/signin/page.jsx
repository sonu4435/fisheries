// app/signin/page.js
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthLayout } from "@/components/auth-layout"
import { Phone, ArrowRight, Shield, CheckCircle, RotateCcw } from "lucide-react"
import { sendOtpToPhone, clearRecaptchaVerifier } from "@/lib/firebaseClient"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function SignInPage() {
  const [step, setStep] = useState(1); // 1: Phone input, 2: OTP input
  const [formData, setFormData] = useState({
    phone: "",
    otp: ["", "", "", "", "", ""],
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [farmerData, setFarmerData] = useState(null)
  const [countdown, setCountdown] = useState(0)
  const [confirmation, setConfirmation] = useState(null)
  const [recaptchaInitialized, setRecaptchaInitialized] = useState(false)

  // In your component
  useEffect(() => {
    // Initialize reCAPTCHA with a small delay to ensure DOM is ready
    const initializeRecaptcha = async () => {
      try {
        // Small delay to ensure container exists
        await new Promise(resolve => setTimeout(resolve, 100));
        setRecaptchaInitialized(true);
      } catch (error) {
        console.error("reCAPTCHA init error:", error);
        setErrors({ submit: "Security verification failed to load. Please refresh." });
      }
    };

    initializeRecaptcha();

    return () => {
      clearRecaptchaVerifier();
    };
  }, []);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
    if (errors.submit) {
      setErrors((prev) => ({ ...prev, submit: "" }))
    }
  }

  // Handle OTP input
  const setOtpDigit = (index, value) => {
    if (!/^\d?$/.test(value)) return

    const newOtp = [...formData.otp];
    newOtp[index] = value;
    setFormData(prev => ({ ...prev, otp: newOtp }));

    // Auto-focus to next input
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }

    // Auto-focus to previous input on backspace
    if (!value && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  }

  // Handle OTP paste
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').trim();

    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split('').slice(0, 6);
      setFormData(prev => ({ ...prev, otp: newOtp }));

      // Focus on the last input
      if (newOtp.length === 6) {
        document.getElementById(`otp-5`)?.focus();
      }
    }
  }

  const validatePhone = () => {
    const newErrors = {}

    if (!formData.phone) {
      newErrors.phone = "Phone number is required"
    } else if (!/^[6-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid 10-digit phone number"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateOTP = () => {
    const newErrors = {}

    if (formData.otp.some((d) => !d)) {
      newErrors.otp = "Please enter all 6 digits of the verification code"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Format phone number for Firebase
  const formatPhoneNumber = (phoneNumber) => {
    let formattedPhone = phoneNumber.trim();
    formattedPhone = formattedPhone.replace(/[^\d+]/g, '');

    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+91' + formattedPhone;
    }

    return formattedPhone;
  }

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();

    if (!validatePhone()) return

    if (!recaptchaInitialized) {
      setErrors({ submit: "Security verification is not ready. Please refresh the page." });
      return;
    }

    setIsLoading(true)
    setErrors({})

    try {
      // First check if phone exists in our database
      const checkResponse = await fetch(`${API_URL}/api/farmer/login/check-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: formData.phone
        })
      })

      const checkResult = await checkResponse.json()

      if (!checkResult.success) {
        setErrors({ submit: checkResult.message })
        return
      }

      // Format phone number for Firebase
      const formattedPhone = formatPhoneNumber(formData.phone);

      // Send OTP via Firebase
      const conf = await sendOtpToPhone(formattedPhone)
      setConfirmation(conf)

      // Store farmer data and move to OTP step
      setFarmerData(checkResult.data)
      setStep(2)
      setCountdown(60) // 60 seconds countdown for resend
      setErrors({})

    } catch (error) {
      console.error("Error sending OTP:", error)

      // Handle Firebase errors with user-friendly messages
      let errorMessage = "Failed to send OTP. Please try again.";

      if (error.code === "auth/invalid-phone-number") {
        errorMessage = "Invalid phone number format. Please check and try again.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many attempts. Please try again later.";
      } else if (error.code === "auth/quota-exceeded") {
        errorMessage = "We're experiencing high demand. Please try again in a few minutes.";
      } else if (error.code === "auth/captcha-check-failed") {
        errorMessage = "Security check failed. Please try again.";
        // Reinitialize recaptcha for next attempt
        setTimeout(() => setRecaptchaInitialized(true), 1000);
      } else if (error.code === "auth/operation-not-allowed") {
        errorMessage = "Phone sign-in is not enabled. Please contact support.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error.code === "auth/internal-error") {
        errorMessage = "Authentication service error. Please refresh the page and try again.";
        // Clear and reinitialize recaptcha
        clearRecaptchaVerifier();
        setTimeout(() => setRecaptchaInitialized(true), 1000);
      }

      setErrors({ submit: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    if (countdown > 0) return

    setIsLoading(true)
    setErrors({})

    try {
      await handleSendOTP();
      setErrors({ submit: "OTP resent successfully!" })
    } catch (error) {
      // Error handling is done in handleSendOTP
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()

    if (!validateOTP()) return

    setIsLoading(true)
    setErrors({})

    try {
      if (!confirmation) {
        setErrors({ submit: "OTP session expired. Please request a new code." });
        setStep(1);
        return;
      }

      const result = await confirmation.confirm(formData.otp.join(""))
      const idToken = await result.user.getIdToken()

      // Login with our backend
      const loginResponse = await fetch(`${API_URL}/api/farmer/login/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: formData.phone,
          idToken: idToken
        })
      })

      const loginResult = await loginResponse.json()

      if (!loginResult.success) {
        setErrors({ submit: loginResult.message })
        return
      }

      // Store token and redirect to farmer dashboard
      localStorage.setItem("farmerToken", loginResult.data.token)
      localStorage.setItem("currentFarmer", JSON.stringify(loginResult.data.farmer))

      console.log("Login successful:", loginResult.data.farmer.name)
      window.location.href = "/dashboard"

    } catch (error) {
      console.error("Error verifying OTP:", error)

      // Handle OTP verification errors
      let errorMessage = "OTP verification failed. Please try again.";

      if (error.code === "auth/invalid-verification-code") {
        errorMessage = "Invalid verification code. Please check and try again.";
      } else if (error.code === "auth/code-expired") {
        errorMessage = "Verification code has expired. Please request a new one.";
      } else if (error.code === "auth/credential-already-in-use") {
        errorMessage = "This phone number is already associated with another account.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error.code === "auth/internal-error") {
        errorMessage = "Verification service error. Please try again.";
      }

      setErrors({ submit: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoBack = () => {
    setStep(1)
    setErrors({})
    setFormData(prev => ({ ...prev, otp: ["", "", "", "", "", ""] }))
    setConfirmation(null)
    clearRecaptchaVerifier();
    setRecaptchaInitialized(true);
  }

  return (
    <AuthLayout
      title={step === 1 ? "Welcome Back" : "Verify OTP"}
      titleOdia={step === 1 ? "ସ୍ୱାଗତମ୍" : "OTP ଯାଞ୍ଚ କରନ୍ତୁ"}
      subtitle={step === 1 ? "Sign in to your farmer account" : "Enter the OTP sent to your phone"}
    >
      <div className="space-y-6">
        {/* Step 1: Phone Input */}
        {step === 1 && (
          <form onSubmit={handleSendOTP} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                Phone Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="9876543210"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value.replace(/\D/g, ""))}
                  className={`pl-10 h-11 ${errors.phone ? "border-destructive" : ""}`}
                  maxLength={10}
                />
              </div>
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>

            {!recaptchaInitialized && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800 text-center">
                  Initializing security verification...
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11"
              disabled={isLoading || !recaptchaInitialized}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Sending OTP...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Send OTP
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </form>
        )}

        {/* Step 2: OTP Input */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <Shield className="h-12 w-12 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                OTP sent to <strong>+91 {formData.phone}</strong>
              </p>
              {farmerData && (
                <p className="text-sm text-green-600 mb-4 flex items-center justify-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Verified: {farmerData.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-center block">
                Enter OTP
              </Label>
              <div className="flex justify-center gap-2">
                {formData.otp.map((digit, index) => (
                  <Input
                    key={index}
                    id={`otp-${index}`}
                    value={digit}
                    onChange={(e) => setOtpDigit(index, e.target.value)}
                    onPaste={index === 0 ? handleOtpPaste : undefined}
                    className="w-12 h-12 text-center text-lg font-mono"
                    maxLength={1}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    disabled={isLoading}
                  />
                ))}
              </div>
              {errors.otp && <p className="text-sm text-destructive text-center">{errors.otp}</p>}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleGoBack}
                className="flex-1 h-11"
                disabled={isLoading}
              >
                Change Number
              </Button>
              <Button
                type="submit"
                className="flex-1 h-11"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Verifying...
                  </div>
                ) : (
                  "Verify OTP"
                )}
              </Button>
            </div>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={handleResendOTP}
                disabled={countdown > 0 || isLoading}
                className="text-sm"
              >
                {countdown > 0 ? (
                  <span className="flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" />
                    Resend in {countdown}s
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" />
                    Resend OTP
                  </span>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Demo Info */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-800 mb-2">How it works:</p>
          <div className="text-xs text-blue-700 space-y-1">
            <p>1. Enter your registered phone number</p>
            <p>2. Verify with OTP sent via SMS</p>
            <p>3. Access your farmer dashboard</p>
          </div>
        </div>

        {errors.submit && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive text-center">{errors.submit}</p>
          </div>
        )}
      </div>

      {/* Sign Up Link */}
      <div className="text-center mt-6">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline font-medium">
            Contact our sales team
          </Link>
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          <span className="font-semibold text-primary">ଓଡ଼ିଆରେ:</span> ଖାତା ନାହିଁ? ଆମର ବିକ୍ରୟ ଦଳକୁ ଯୋଗାଯୋଗ କରନ୍ତୁ
        </p>
      </div>

      {/* Trust Badge */}
      <div className="mt-8 p-4 bg-secondary/50 rounded-lg text-center">
        <p className="text-xs text-muted-foreground">
          🔒 Secure OTP verification. Your data is protected.
        </p>
      </div>

      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container" className="hidden" />
    </AuthLayout>
  )
}