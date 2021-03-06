import {Tree} from "#appjs/tree.js"
import {default as assert} from 'assert'

describe('Tree', function () {
    it('Basic tree access', function () {
      let tree = new Tree()
      let obj1 = {'A':123}
      let obj2 = {'B':222}
      tree.add("/a/b/c", obj1)
      tree.add("/a/b/d", obj2)
      assert.equal(obj1, tree.get_obj('/a/b/c'))
      assert.equal(obj2, tree.get_obj('/a/b/d'))
    });
});
