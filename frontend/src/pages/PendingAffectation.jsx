function PendingAffectation({ onLogout, user }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white shadow-sm rounded-xl border border-slate-200 p-6 space-y-3 text-center">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-semibold">
            ⏳
          </div>
        </div>
        <h1 className="text-xl font-semibold text-slate-900">
          Accès en attente
        </h1>
        <p className="text-sm text-slate-600">
          {user?.nom || 'Votre compte'} n’est pas encore rattaché à un magasin.
          Demandez à un administrateur de vous affecter à un magasin pour accéder à l’application.
        </p>
        <p className="text-xs text-slate-500">
          Si vous êtes administrateur, utilisez un compte ADMIN ou SUPER_ADMIN pour effectuer l’affectation.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={onLogout}
            className="rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-sm font-semibold transition"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}

export default PendingAffectation
