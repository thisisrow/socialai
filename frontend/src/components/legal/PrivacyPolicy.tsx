

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">Privacy Policy</h1>
        
        <div className="space-y-6 text-gray-600">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-800">1. Information We Collect</h2>
            <p>When you use our service, we may collect the following information:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>Your name and email address (when you create an account)</li>
              <li>Your Instagram account details such as:
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Instagram username and account ID</li>
                  <li>Instagram posts and post IDs</li>
                  <li> Context that you will provide  associated with post  </li>
                </ul>
              </li>
              <li>Any information you provide when contacting our support team</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-800">2. How We Use Your Information</h2>
            <p>We use the collected information solely for the following purposes:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>Automating replies and managing your Instagram interactions</li>
              <li>Providing and maintaining our services</li>
              <li>Improving service performance and adding new features</li>
              <li>Communicating important updates about your account</li>
            </ul>
            <p className="mt-2">We do <strong>not</strong> sell, rent, or trade your information with third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-800">3. Data Security</h2>
            <p>We take data protection seriously. Measures include:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security and compliance reviews</li>
              <li>Restricted access to personal information</li>
              <li>Secure storage with industry-standard practices</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-800">4. Sharing of Information</h2>
            <p>We do not share your personal data with third parties except:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>Instagram API, strictly for providing the automation features you enable</li>
            </ul>
            <p className="mt-2">These providers are bound by confidentiality and data protection agreements.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-800">5. Data Retention</h2>
            <p>We retain your information only for as long as your account is active or as needed to provide our services. 
            You may request deletion of your data at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-800">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>Access the personal data we hold about you</li>
              <li>Request corrections of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Withdraw consent to data processing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-800">7. Children’s Privacy</h2>
            <p>Our services are not directed to individuals under the age of 13. We do not knowingly collect information from children.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-800">8. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us at:</p>
            <p className="mt-2">Email: <a href="mailto:sahilgame285@gmail.com" className="text-blue-600">sahilgame285@gmail.com</a></p>
          </section>

          <section className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Last updated: September 7, 2025
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
