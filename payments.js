/**
 * payments.js
 * ---------------------------------------------------------------------------
 * Section 24: Payment architecture. Provider-agnostic — Paystack and
 * Flutterwave both implement the same PaymentProvider interface so a new
 * provider can be added without touching checkout.js or courses.js.
 *
 * FLOW (matches Section 24 exactly):
 *   Student → Select Course → Checkout → Payment Provider (client widget)
 *   → Payment Verification (SERVER-SIDE, Cloud Function) → Enrollment →
 *   Course Access.
 *
 * CRITICAL: access is granted ONLY after `verifyPayment()` succeeds, which
 * calls a Cloud Function that re-checks the transaction directly against
 * Paystack/Flutterwave's servers using a SECRET key that lives only in
 * Cloud Functions config — never in this file, never in the browser. A
 * client-side "payment successful" callback is never sufficient on its own
 * (Section 24: "Never grant course access based only on frontend
 * confirmation").
 * ---------------------------------------------------------------------------
 */

const Payments = (() => {
  const PROVIDERS = {
    paystack: {
      name: "Paystack",
      // Paystack Inline JS must be included separately if you enable this
      // provider: <script src="https://js.paystack.co/v1/inline.js"></script>
      async pay({ email, amountKobo, reference, publicKey, onSuccess, onClose }) {
        if (typeof PaystackPop === "undefined") {
          throw new Error("Paystack script not loaded. Add js.paystack.co script tag.");
        }
        const handler = PaystackPop.setup({
          key: publicKey, email, amount: amountKobo, ref: reference,
          callback: (response) => onSuccess(response.reference),
          onClose,
        });
        handler.openIframe();
      },
    },
    flutterwave: {
      name: "Flutterwave",
      // Requires <script src="https://checkout.flutterwave.com/v3.js"></script>
      async pay({ email, amount, reference, publicKey, onSuccess, onClose }) {
        if (typeof FlutterwaveCheckout === "undefined") {
          throw new Error("Flutterwave script not loaded.");
        }
        FlutterwaveCheckout({
          public_key: publicKey,
          tx_ref: reference,
          amount,
          currency: "NGN",
          customer: { email },
          callback: (response) => onSuccess(response.transaction_id || reference),
          onclose: onClose,
        });
      },
    },
  };

  function generateReference(courseId) {
    return `sc_${courseId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Step 1–3: open the chosen provider's checkout widget. */
  async function startCheckout({ provider, course, student, publicKey }) {
    const impl = PROVIDERS[provider];
    if (!impl) throw new Error(`Unknown payment provider: ${provider}`);
    const reference = generateReference(course.id);

    await db.collection("payments").doc(reference).set({
      id: reference, studentId: student.id, courseId: course.id, provider,
      providerReference: reference, amount: course.discountPrice ?? course.price,
      status: "pending", createdAt: new Date().toISOString(),
    });

    return new Promise((resolve, reject) => {
      impl.pay({
        email: student.email,
        amountKobo: Math.round((course.discountPrice ?? course.price) * 100),
        amount: course.discountPrice ?? course.price,
        reference, publicKey,
        onSuccess: async (providerRef) => {
          try { resolve(await verifyPayment(reference, providerRef, provider)); }
          catch (e) { reject(e); }
        },
        onClose: () => reject(new Error("Payment window closed before completion.")),
      });
    });
  }

  /** Step 4: SERVER-SIDE verification + enrollment (never trust the client). */
  async function verifyPayment(paymentDocId, providerReference, provider) {
    const user = auth.currentUser;
    const idToken = await user.getIdToken();
    const res = await fetch(`${FUNCTIONS_BASE_URL}/verifyPayment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ paymentDocId, providerReference, provider }),
    });
    if (!res.ok) throw new Error("Payment verification failed.");
    return res.json(); // { enrolled: true, courseId }
  }

  return { startCheckout, verifyPayment, PROVIDERS };
})();
