/**
 * 用户存储库接口
 * 
 * 定义了与用户相关的数据访问操作
 */

/**
 * 用户信息
 */
export interface UserInfo {
  id: string;
  nickname?: string | null;
  role?: string;
  created_at?: string;
}

/**
 * 用户存储库接口
 */
export interface IUserRepository {
  /**
   * 获取用户信息
   * @param userId 用户ID
   * @returns 用户信息或null
   */
  getUserInfo(userId: string): Promise<UserInfo | null>;
  
  /**
   * 更新用户昵称
   * @param userId 用户ID
   * @param nickname 新昵称，null表示清除昵称
   */
  updateNickname(userId: string, nickname: string | null): Promise<void>;
  
  /**
   * 更新用户角色
   * @param userId 用户ID
   * @param role 新角色
   */
  updateRole(userId: string, role: string): Promise<void>;
}
