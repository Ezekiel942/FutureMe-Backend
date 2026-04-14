export interface User {
  id: string;
}

export const getUser = async (id: string): Promise<User> => {
  return { id };
};
