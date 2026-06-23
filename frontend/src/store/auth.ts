export const getToken = () => localStorage.getItem('token');
export const getUser = () => {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
};
export const setAuth = (token: string, user: any) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};
export const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};
