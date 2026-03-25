const USER_ID_KEY = 'dark-forest-user-id'
const USERNAME_KEY = 'dark-forest-username'

export function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

export function getUsername(): string {
  return localStorage.getItem(USERNAME_KEY) ?? ''
}

export function setUsername(name: string): void {
  localStorage.setItem(USERNAME_KEY, name)
}
